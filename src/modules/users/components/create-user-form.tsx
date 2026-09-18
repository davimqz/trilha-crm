"use client";

import { useActionState } from "react";

import { FieldError, FormFeedback } from "@/components/form/form-feedback";
import { NativeSelect } from "@/components/form/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IDLE } from "@/core/actions/action-state";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/core/auth/password-policy";
import { ROLE_LABELS, ROLES } from "@/core/rbac/roles";

import { createUserAction } from "../actions";

export function CreateUserForm() {
  const [result, formAction, pending] = useActionState(createUserAction, IDLE);
  const errors = result.fieldErrors ?? {};

  return (
    // key: remonta o form (limpa os campos) a cada criação bem-sucedida
    <form key={result.status === "success" ? result.message : "form"} action={formAction} className="grid gap-4" noValidate>
      <FormFeedback result={result} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="new-user-name">Nome</Label>
          <Input id="new-user-name" name="name" required maxLength={100} aria-invalid={!!errors.name} aria-describedby="new-user-name-error" />
          <FieldError id="new-user-name-error" message={errors.name} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="new-user-email">E-mail</Label>
          <Input id="new-user-email" name="email" type="email" required maxLength={254} autoComplete="off" aria-invalid={!!errors.email} aria-describedby="new-user-email-error" />
          <FieldError id="new-user-email-error" message={errors.email} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="new-user-role">Papel</Label>
          <NativeSelect id="new-user-role" name="role" defaultValue="sales" aria-invalid={!!errors.role} aria-describedby="new-user-role-error">
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </NativeSelect>
          <FieldError id="new-user-role-error" message={errors.role} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="new-user-password">Senha inicial</Label>
          <Input id="new-user-password" name="password" type="password" required minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} autoComplete="new-password" aria-invalid={!!errors.password} aria-describedby="new-user-password-error" />
          <FieldError id="new-user-password-error" message={errors.password ?? `Mínimo de ${PASSWORD_MIN_LENGTH} caracteres.`} />
        </div>
      </div>
      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? "Criando…" : "Criar usuário"}
      </Button>
    </form>
  );
}
