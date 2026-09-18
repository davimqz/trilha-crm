import Link from "next/link";

import { requireActor } from "@/core/auth/session";
import { getNavigationForRole } from "@/core/modules/permissions";
import { ROLE_LABELS } from "@/core/rbac/roles";
import { MODULES } from "@/modules/registry";

import { SignOutButton } from "./sign-out-button";

// O layout só monta o menu; cada page revalida a sessão e a permissão (layouts não re-renderizam na navegação)
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const actor = await requireActor();
  const navigation = getNavigationForRole(MODULES, actor.role);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-4">
          <Link href="/" className="font-semibold">
            Trilha CRM
          </Link>
          <nav aria-label="Principal" className="flex flex-1 items-center gap-4 text-sm">
            {navigation.map((item) => (
              <Link key={item.href} href={item.href} className="text-muted-foreground hover:text-foreground">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/account/password" className="hidden text-muted-foreground hover:text-foreground sm:inline">
              {actor.name} · {ROLE_LABELS[actor.role]}
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
