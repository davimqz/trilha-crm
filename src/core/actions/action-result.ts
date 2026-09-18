import { ZodError } from "zod";

import { DomainError } from "@/core/errors";
import { ForbiddenError } from "@/core/rbac/authorization";

import type { ActionResult } from "./action-state";

export type { ActionResult } from "./action-state";

// Converte exceções em respostas seguras: detalhes internos só vão para o log do servidor
export async function runAction(operation: () => Promise<string>): Promise<ActionResult> {
  try {
    return { status: "success", message: await operation() };
  } catch (error) {
    if (error instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of error.issues) {
        const field = String(issue.path[0] ?? "form");
        fieldErrors[field] ??= issue.message;
      }
      return { status: "error", message: "Verifique os campos destacados.", fieldErrors };
    }
    if (error instanceof ForbiddenError || error instanceof DomainError) {
      return { status: "error", message: error.message };
    }
    console.error("[action] erro inesperado", error);
    return { status: "error", message: "Não foi possível concluir a operação. Tente novamente." };
  }
}

export function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}
