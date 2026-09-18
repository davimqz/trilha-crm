import { cookies } from "next/headers";

import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { requireActor } from "@/core/auth/session";
import { getNavigationForRole } from "@/core/modules/permissions";
import { ROLE_LABELS } from "@/core/rbac/roles";
import { MODULES } from "@/modules/registry";

import { AppSidebar } from "./app-sidebar";

// O layout só monta o menu; cada page revalida a sessão e a permissão (layouts não re-renderizam na navegação)
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const actor = await requireActor();
  const items = getNavigationForRole(MODULES, actor.role).map(({ label, href, icon }) => ({ label, href, icon }));
  // Estado aberto/recolhido salvo pelo componente em cookie: evita o menu "piscar" ao carregar
  const sidebarOpen = (await cookies()).get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <AppSidebar items={items} user={{ name: actor.name, email: actor.email, roleLabel: ROLE_LABELS[actor.role] }} />
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
          <SidebarTrigger className="-ml-1" aria-label="Mostrar ou recolher o menu" />
          <Separator orientation="vertical" className="h-4" />
          <span className="text-sm text-muted-foreground">Trilha CRM</span>
        </header>
        <div className="min-w-0 flex-1 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
