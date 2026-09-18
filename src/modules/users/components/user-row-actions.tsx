"use client";

import { useActionState, useState } from "react";

import { FormFeedback } from "@/components/form/form-feedback";
import { NativeSelect } from "@/components/form/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IDLE } from "@/core/actions/action-state";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/core/auth/password-policy";
import { ROLE_LABELS, ROLES, type Role } from "@/core/rbac/roles";

import { changeRoleAction, resetPasswordAction, setActiveAction } from "../actions";

type UserRowActionsProps = { userId: string; userName: string; role: Role; active: boolean };

export function UserRowActions({ userId, userName, role, active }: UserRowActionsProps) {
  const [roleResult, roleAction, rolePending] = useActionState(changeRoleAction, IDLE);
  const [activeResult, activeAction, activePending] = useActionState(setActiveAction, IDLE);
  const [passwordResult, passwordAction, passwordPending] = useActionState(resetPasswordAction, IDLE);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <form action={roleAction} className="flex items-center gap-2">
          <input type="hidden" name="userId" value={userId} />
          <NativeSelect name="role" defaultValue={role} aria-label={`Papel de ${userName}`} className="w-36">
            {ROLES.map((option) => (
              <option key={option} value={option}>
                {ROLE_LABELS[option]}
              </option>
            ))}
          </NativeSelect>
          <Button type="submit" variant="outline" size="sm" disabled={rolePending}>
            Salvar papel
          </Button>
        </form>

        <form action={activeAction}>
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="active" value={String(!active)} />
          <Button type="submit" variant={active ? "destructive" : "outline"} size="sm" disabled={activePending}>
            {active ? "Desativar" : "Reativar"}
          </Button>
        </form>

        <Button type="button" variant="ghost" size="sm" onClick={() => setShowPassword((value) => !value)} aria-expanded={showPassword}>
          Redefinir senha
        </Button>
      </div>

      {showPassword && (
        <form action={passwordAction} className="flex items-center gap-2">
          <input type="hidden" name="userId" value={userId} />
          <Input name="password" type="password" required minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} autoComplete="new-password" placeholder={`Nova senha (mín. ${PASSWORD_MIN_LENGTH})`} aria-label={`Nova senha de ${userName}`} className="w-56" />
          <Button type="submit" size="sm" disabled={passwordPending}>
            Salvar senha
          </Button>
        </form>
      )}

      <FormFeedback result={roleResult} />
      <FormFeedback result={activeResult} />
      <FormFeedback result={passwordResult} />
    </div>
  );
}
