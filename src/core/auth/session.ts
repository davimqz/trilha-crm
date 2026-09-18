import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import type { Actor } from "@/core/rbac/authorization";
import { isRole } from "@/core/rbac/roles";

import { getAuth } from ".";

// DAL de sessão: papel e status vêm do banco a cada request (sem cache em cookie)
export const getCurrentActor = cache(async (): Promise<Actor | null> => {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return null;

  const { id, name, email, role, active } = session.user;
  if (!active || !isRole(role)) return null;

  return { userId: id, name, email, role };
});

export async function requireActor(): Promise<Actor> {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login");
  return actor;
}
