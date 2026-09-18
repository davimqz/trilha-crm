import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { sessions, users } from "@/core/auth/schema";
import { ConflictError, DomainError, NotFoundError } from "@/core/errors";
import { ForbiddenError } from "@/core/rbac/authorization";
import type { Role } from "@/core/rbac/roles";

import {
  TEST_PASSWORD,
  createTestContext,
  getSessionUser,
  signIn,
  toActor,
} from "../../../../test/helpers/auth-context";

const context = createTestContext();
const { usersService, auth, db } = context;

async function bootstrap() {
  return toActor(
    await usersService.bootstrapAdmin({ name: "Admin", email: "admin@trilha.test", password: TEST_PASSWORD }),
  );
}

async function createAs(admin: ReturnType<typeof toActor>, role: Role, email = `${role}@trilha.test`) {
  return usersService.createUser(admin, { name: `Usuário ${role}`, email, role, password: TEST_PASSWORD });
}

describe("users service", () => {
  beforeEach(() => context.reset());
  afterAll(() => context.close());

  describe("bootstrapAdmin", () => {
    it("cria o primeiro admin e ele consegue entrar", async () => {
      const admin = await bootstrap();
      expect(admin.role).toBe("admin");

      const { response, cookie } = await signIn(auth, "admin@trilha.test", TEST_PASSWORD);
      expect(response.status).toBe(200);
      expect((await getSessionUser(auth, cookie))?.role).toBe("admin");
    });

    it("recusa criar um segundo admin por bootstrap", async () => {
      await bootstrap();
      await expect(
        usersService.bootstrapAdmin({ name: "Outro", email: "outro@trilha.test", password: TEST_PASSWORD }),
      ).rejects.toThrow(DomainError);
    });
  });

  describe("createUser", () => {
    it("admin cria usuário que consegue entrar com o papel definido", async () => {
      const admin = await bootstrap();
      const created = await createAs(admin, "sales");

      expect(created).toMatchObject({ email: "sales@trilha.test", role: "sales", active: true });
      expect(created).not.toHaveProperty("password");

      const { response, cookie } = await signIn(auth, "sales@trilha.test", TEST_PASSWORD);
      expect(response.status).toBe(200);
      expect((await getSessionUser(auth, cookie))?.role).toBe("sales");
    });

    it("normaliza e-mail e recusa duplicado (sem diferenciar maiúsculas)", async () => {
      const admin = await bootstrap();
      await usersService.createUser(admin, {
        name: "Ana",
        email: "  Ana@Trilha.Test ",
        role: "viewer",
        password: TEST_PASSWORD,
      });
      await expect(createAs(admin, "viewer", "ana@trilha.test")).rejects.toThrow(ConflictError);
    });

    it("rejeita campos extras (mass assignment) e senha curta", async () => {
      const admin = await bootstrap();
      const withExtra = { name: "X", email: "x@trilha.test", role: "viewer", password: TEST_PASSWORD, active: false };
      await expect(usersService.createUser(admin, withExtra)).rejects.toThrow(ZodError);
      await expect(
        usersService.createUser(admin, { name: "Xx", email: "x@trilha.test", role: "viewer", password: "curta" }),
      ).rejects.toThrow(ZodError);
    });

    it("rejeita papel inexistente", async () => {
      const admin = await bootstrap();
      await expect(
        usersService.createUser(admin, {
          name: "Xx",
          email: "x@trilha.test",
          role: "root" as Role,
          password: TEST_PASSWORD,
        }),
      ).rejects.toThrow(ZodError);
    });
  });

  describe("autorização", () => {
    for (const role of ["manager", "sales", "viewer"] as const) {
      it(`${role} não acessa nenhuma operação de usuários`, async () => {
        const admin = await bootstrap();
        const actor = toActor(await createAs(admin, role));
        const target = await createAs(admin, "viewer", "alvo@trilha.test");

        await expect(usersService.listUsers(actor)).rejects.toThrow(ForbiddenError);
        await expect(createAs(actor, "admin", "novo@trilha.test")).rejects.toThrow(ForbiddenError);
        await expect(usersService.changeRole(actor, { userId: target.id, role: "admin" })).rejects.toThrow(
          ForbiddenError,
        );
        await expect(usersService.setActive(actor, { userId: target.id, active: false })).rejects.toThrow(
          ForbiddenError,
        );
        await expect(
          usersService.resetPassword(actor, { userId: target.id, password: TEST_PASSWORD }),
        ).rejects.toThrow(ForbiddenError);
      });
    }

    it("revalida o ator no banco: admin rebaixado não opera com sessão antiga", async () => {
      const admin = await bootstrap();
      const other = toActor(await createAs(admin, "admin", "admin2@trilha.test"));
      await usersService.changeRole(admin, { userId: other.userId, role: "sales" });

      // `other` ainda carrega role "admin" no objeto em memória
      await expect(createAs(other, "viewer", "x@trilha.test")).rejects.toThrow(ForbiddenError);
    });

    it("admin desativado não opera", async () => {
      const admin = await bootstrap();
      const other = toActor(await createAs(admin, "admin", "admin2@trilha.test"));
      await usersService.setActive(admin, { userId: other.userId, active: false });
      await expect(createAs(other, "viewer", "x@trilha.test")).rejects.toThrow(ForbiddenError);
    });
  });

  describe("changeRole", () => {
    it("altera o papel e o efeito vale na sessão existente", async () => {
      const admin = await bootstrap();
      const user = await createAs(admin, "viewer");
      const { cookie } = await signIn(auth, user.email, TEST_PASSWORD);

      await usersService.changeRole(admin, { userId: user.id, role: "manager" });
      expect((await getSessionUser(auth, cookie))?.role).toBe("manager");
    });

    it("admin não altera o próprio papel", async () => {
      const admin = await bootstrap();
      await expect(usersService.changeRole(admin, { userId: admin.userId, role: "viewer" })).rejects.toThrow(
        DomainError,
      );
    });

    it("usuário inexistente → NotFound", async () => {
      const admin = await bootstrap();
      await expect(
        usersService.changeRole(admin, { userId: "00000000-0000-4000-8000-000000000000", role: "viewer" }),
      ).rejects.toThrow(NotFoundError);
    });

    it("alteração concorrente: espera o lock e revalida o ator (sempre sobra um admin)", async () => {
      const first = await bootstrap();
      const second = toActor(await createAs(first, "admin", "admin2@trilha.test"));

      let pending: Promise<void> | undefined;
      let settled = false;

      // Simula `second` rebaixando `first` enquanto `first` tenta rebaixar `second`
      await db.transaction(async (tx) => {
        await tx.select().from(users).where(eq(users.id, first.userId)).for("update");

        pending = usersService.changeRole(first, { userId: second.userId, role: "viewer" });
        pending.then(
          () => (settled = true),
          () => (settled = true),
        );
        await new Promise((resolve) => setTimeout(resolve, 300));
        expect(settled).toBe(false); // bloqueado no lock da linha do ator

        await tx.update(users).set({ role: "viewer" }).where(eq(users.id, first.userId));
      });

      await expect(pending).rejects.toThrow(ForbiddenError);
      const admins = await db.select().from(users).where(eq(users.role, "admin"));
      expect(admins.map((admin) => admin.id)).toEqual([second.userId]);
    });
  });

  describe("setActive", () => {
    it("desativar derruba sessões e bloqueia login; reativar libera", async () => {
      const admin = await bootstrap();
      const user = await createAs(admin, "sales");
      const { cookie } = await signIn(auth, user.email, TEST_PASSWORD);
      expect(await getSessionUser(auth, cookie)).not.toBeNull();

      await usersService.setActive(admin, { userId: user.id, active: false });

      expect(await db.select().from(sessions).where(eq(sessions.userId, user.id))).toHaveLength(0);
      expect(await getSessionUser(auth, cookie)).toBeNull();
      expect((await signIn(auth, user.email, TEST_PASSWORD)).response.status).toBe(403);

      await usersService.setActive(admin, { userId: user.id, active: true });
      expect((await signIn(auth, user.email, TEST_PASSWORD)).response.status).toBe(200);
    });

    it("admin não desativa a própria conta", async () => {
      const admin = await bootstrap();
      await expect(usersService.setActive(admin, { userId: admin.userId, active: false })).rejects.toThrow(
        DomainError,
      );
    });
  });

  describe("resetPassword", () => {
    it("troca a senha, invalida a antiga e derruba as sessões", async () => {
      const admin = await bootstrap();
      const user = await createAs(admin, "sales");
      const { cookie } = await signIn(auth, user.email, TEST_PASSWORD);

      await usersService.resetPassword(admin, { userId: user.id, password: "nova-senha-segura-456" });

      expect(await getSessionUser(auth, cookie)).toBeNull();
      expect((await signIn(auth, user.email, TEST_PASSWORD)).response.status).toBe(401);
      expect((await signIn(auth, user.email, "nova-senha-segura-456")).response.status).toBe(200);
    });

    it("admin não redefine a própria senha por aqui", async () => {
      const admin = await bootstrap();
      await expect(
        usersService.resetPassword(admin, { userId: admin.userId, password: TEST_PASSWORD }),
      ).rejects.toThrow(DomainError);
    });
  });

  describe("listUsers", () => {
    it("lista ordenado por nome, sem dados sensíveis", async () => {
      const admin = await bootstrap();
      await createAs(admin, "viewer");
      const list = await usersService.listUsers(admin);

      expect(list.map((user) => user.name)).toEqual(["Admin", "Usuário viewer"]);
      for (const user of list) {
        expect(Object.keys(user).sort()).toEqual(["active", "createdAt", "email", "id", "name", "role"]);
      }
    });
  });
});
