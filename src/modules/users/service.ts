import "server-only";

import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { getAuth, type Auth } from "@/core/auth";
import { accounts, sessions, users } from "@/core/auth/schema";
import { getDb } from "@/core/db";
import type { Database } from "@/core/db/create-database";
import { ConflictError, DomainError, NotFoundError, isUniqueViolation } from "@/core/errors";
import { ForbiddenError, type Actor } from "@/core/rbac/authorization";
import { isRole, type Role } from "@/core/rbac/roles";
import { requirePermission } from "@/modules/authorization";

import {
  changeRoleSchema,
  createUserSchema,
  resetPasswordSchema,
  setActiveSchema,
  type CreateUserInput,
} from "./validators";

// DTO: nunca inclui hash de senha nem dados de sessão
export type UserSummary = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: Date;
};

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

type UsersServiceDeps = { db: Database; auth: Auth };

const CREDENTIAL_PROVIDER = "credential";

const summaryColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  active: users.active,
  createdAt: users.createdAt,
};

function toSummary(row: { id: string; name: string; email: string; role: string; active: boolean; createdAt: Date }) {
  // O CHECK do banco garante papéis válidos; papel inesperado vira "viewer" (menor privilégio)
  return { ...row, role: isRole(row.role) ? row.role : "viewer" } satisfies UserSummary;
}

// Métodos recebem `input: unknown`: toda entrada é tratada como não confiável e validada com Zod aqui
export function createUsersService({ db, auth }: UsersServiceDeps) {
  async function hashPassword(password: string) {
    const context = await auth.$context;
    return context.password.hash(password);
  }

  // Trava as linhas do ator e do alvo e revalida o ator com dados do banco. Serializa alterações
  // concorrentes entre admins (ex.: dois admins rebaixando um ao outro ao mesmo tempo).
  async function lockForManagement(tx: Transaction, actor: Actor, targetUserId?: string) {
    const ids = targetUserId ? [actor.userId, targetUserId] : [actor.userId];
    const rows = await tx
      .select({ id: users.id, role: users.role, active: users.active })
      .from(users)
      .where(inArray(users.id, ids))
      .orderBy(asc(users.id))
      .for("update");

    const actorRow = rows.find((row) => row.id === actor.userId);
    if (!actorRow?.active || !isRole(actorRow.role)) throw new ForbiddenError();
    requirePermission({ role: actorRow.role }, "users:manage");

    if (!targetUserId) return undefined;
    const target = rows.find((row) => row.id === targetUserId);
    if (!target) throw new NotFoundError("Usuário não encontrado.");
    return target;
  }

  async function insertUserWithPassword(
    tx: Transaction,
    data: { name: string; email: string; role: Role; passwordHash: string },
  ) {
    const [created] = await tx
      .insert(users)
      .values({ name: data.name, email: data.email, role: data.role, active: true })
      .returning(summaryColumns);
    await tx.insert(accounts).values({
      accountId: created.id,
      providerId: CREDENTIAL_PROVIDER,
      userId: created.id,
      password: data.passwordHash,
    });
    return toSummary(created);
  }

  function rethrowDuplicateEmail(error: unknown): never {
    if (isUniqueViolation(error)) throw new ConflictError("Já existe um usuário com este e-mail.");
    throw error;
  }

  return {
    async listUsers(actor: Actor): Promise<UserSummary[]> {
      requirePermission(actor, "users:read");
      const rows = await db.select(summaryColumns).from(users).orderBy(asc(users.name));
      return rows.map(toSummary);
    },

    async createUser(actor: Actor, input: unknown): Promise<UserSummary> {
      requirePermission(actor, "users:manage");
      const data = createUserSchema.parse(input);
      const passwordHash = await hashPassword(data.password);

      try {
        return await db.transaction(async (tx) => {
          await lockForManagement(tx, actor);
          return insertUserWithPassword(tx, { ...data, passwordHash });
        });
      } catch (error) {
        rethrowDuplicateEmail(error);
      }
    },

    async changeRole(actor: Actor, input: unknown): Promise<void> {
      requirePermission(actor, "users:manage");
      const data = changeRoleSchema.parse(input);
      if (data.userId === actor.userId) throw new DomainError("Você não pode alterar o próprio papel.");

      await db.transaction(async (tx) => {
        await lockForManagement(tx, actor, data.userId);
        await tx.update(users).set({ role: data.role }).where(eq(users.id, data.userId));
      });
    },

    async setActive(actor: Actor, input: unknown): Promise<void> {
      requirePermission(actor, "users:manage");
      const data = setActiveSchema.parse(input);
      if (data.userId === actor.userId) throw new DomainError("Você não pode desativar a própria conta.");

      await db.transaction(async (tx) => {
        await lockForManagement(tx, actor, data.userId);
        await tx.update(users).set({ active: data.active }).where(eq(users.id, data.userId));
        // Desativar derruba todas as sessões abertas imediatamente
        if (!data.active) await tx.delete(sessions).where(eq(sessions.userId, data.userId));
      });
    },

    async resetPassword(actor: Actor, input: unknown): Promise<void> {
      requirePermission(actor, "users:manage");
      const data = resetPasswordSchema.parse(input);
      if (data.userId === actor.userId) {
        throw new DomainError("Para trocar a sua senha, use a opção “Alterar minha senha”.");
      }
      const passwordHash = await hashPassword(data.password);

      await db.transaction(async (tx) => {
        await lockForManagement(tx, actor, data.userId);
        const updated = await tx
          .update(accounts)
          .set({ password: passwordHash })
          .where(and(eq(accounts.userId, data.userId), eq(accounts.providerId, CREDENTIAL_PROVIDER)))
          .returning({ id: accounts.id });
        if (updated.length === 0) {
          await tx.insert(accounts).values({
            accountId: data.userId,
            providerId: CREDENTIAL_PROVIDER,
            userId: data.userId,
            password: passwordHash,
          });
        }
        await tx.delete(sessions).where(eq(sessions.userId, data.userId));
      });
    },

    // Uso exclusivo do script de bootstrap (sem ator): só funciona se não houver admin ativo
    async bootstrapAdmin(input: Omit<CreateUserInput, "role">): Promise<UserSummary> {
      const data = createUserSchema.parse({ ...input, role: "admin" });
      const passwordHash = await hashPassword(data.password);

      try {
        return await db.transaction(async (tx) => {
          await tx.execute(sql`select pg_advisory_xact_lock(hashtext('trilha:bootstrap-admin'))`);
          const [existing] = await tx
            .select({ id: users.id })
            .from(users)
            .where(and(eq(users.role, "admin"), eq(users.active, true)))
            .limit(1);
          if (existing) throw new DomainError("Já existe um administrador ativo. Use a tela de usuários.");
          return insertUserWithPassword(tx, { ...data, passwordHash });
        });
      } catch (error) {
        rethrowDuplicateEmail(error);
      }
    },
  };
}

export type UsersService = ReturnType<typeof createUsersService>;

export function getUsersService(): UsersService {
  return createUsersService({ db: getDb(), auth: getAuth() });
}
