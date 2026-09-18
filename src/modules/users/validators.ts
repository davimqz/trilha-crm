import { z } from "zod";

import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/core/auth/password-policy";
import { ROLES } from "@/core/rbac/roles";

const userId = z.uuid("Usuário inválido.");

const name = z
  .string()
  .trim()
  .min(2, "Informe o nome (mínimo 2 caracteres).")
  .max(100, "Nome muito longo (máximo 100 caracteres).");

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "E-mail muito longo.")
  .pipe(z.email("E-mail inválido."));

const password = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `A senha deve ter ao menos ${PASSWORD_MIN_LENGTH} caracteres.`)
  .max(PASSWORD_MAX_LENGTH, `A senha deve ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`);

const role = z.enum(ROLES, "Papel inválido.");

// strictObject: rejeita campos extras (ex.: id, active) enviados pelo cliente
export const createUserSchema = z.strictObject({ name, email, role, password });
export const changeRoleSchema = z.strictObject({ userId, role });
export const setActiveSchema = z.strictObject({ userId, active: z.boolean() });
export const resetPasswordSchema = z.strictObject({ userId, password });

export type CreateUserInput = z.input<typeof createUserSchema>;
export type ChangeRoleInput = z.input<typeof changeRoleSchema>;
export type SetActiveInput = z.input<typeof setActiveSchema>;
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;
