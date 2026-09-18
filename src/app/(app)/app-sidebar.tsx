"use client";

import {
  BuildingIcon,
  ChevronsUpDownIcon,
  HouseIcon,
  KanbanSquareIcon,
  KeyRoundIcon,
  LogOutIcon,
  SettingsIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { authClient } from "@/core/auth/client";
import type { NavIcon } from "@/core/modules/types";

const ICONS: Record<NavIcon, LucideIcon> = {
  home: HouseIcon,
  kanban: KanbanSquareIcon,
  users: UsersIcon,
  building: BuildingIcon,
  settings: SettingsIcon,
};

export type SidebarNavItem = { label: string; href: string; icon?: NavIcon };

type AppSidebarProps = { items: SidebarNavItem[]; user: { name: string; email: string; roleLabel: string } };

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function AppSidebar({ items, user }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();

  // "/" só é ativo na própria página inicial; os demais também nas subrotas
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));
  const menu: SidebarNavItem[] = [{ label: "Início", href: "/", icon: "home" }, ...items];

  async function signOut() {
    await authClient.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/" />} tooltip="Trilha CRM">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground">
                T
              </div>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate font-semibold">Trilha CRM</span>
                <span className="truncate text-xs text-muted-foreground">Trilha Finance</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <nav aria-label="Principal">
              <SidebarMenu>
                {menu.map((item) => {
                  const Icon = item.icon ? ICONS[item.icon] : undefined;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={isActive(item.href)}
                        tooltip={item.label}
                        render={
                          <Link
                            href={item.href}
                            aria-current={isActive(item.href) ? "page" : undefined}
                            onClick={() => isMobile && setOpenMobile(false)}
                          />
                        }
                      >
                        {Icon && <Icon />}
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton size="lg" aria-label={`Conta de ${user.name}`} className="data-popup-open:bg-sidebar-accent" />
                }
              >
                <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-xs font-semibold">
                  {initialsOf(user.name)}
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{user.roleLabel}</span>
                </div>
                <ChevronsUpDownIcon className="ml-auto size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent side={isMobile ? "bottom" : "right"} align="end" className="min-w-56">
                {/* No Base UI o rótulo precisa estar dentro de um grupo (senão o menu quebra ao abrir) */}
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="font-normal">
                    <div className="grid text-sm leading-tight">
                      <span className="font-medium">{user.name}</span>
                      <span className="text-xs text-muted-foreground">{user.email}</span>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem render={<Link href="/account/password" />}>
                  <KeyRoundIcon />
                  Alterar minha senha
                </DropdownMenuItem>
                <DropdownMenuItem onClick={signOut}>
                  <LogOutIcon />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
