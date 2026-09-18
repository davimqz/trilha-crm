"use client";

import { createAuthClient } from "better-auth/react";

// Login, logout e troca de senha passam pelo endpoint HTTP, onde o rate limit se aplica (ADR-005)
export const authClient = createAuthClient();

export function authErrorMessage(status: number | undefined, fallback: string): string {
  if (status === 429) return "Muitas tentativas. Aguarde um minuto e tente novamente.";
  return fallback;
}
