"use client";

import { useActionState } from "react";

import { FieldError, FormFeedback } from "@/components/form/form-feedback";
import { NativeSelect } from "@/components/form/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IDLE } from "@/core/actions/action-state";
import { formatDateTime } from "@/lib/format";
import { LEAD_NAME_MAX } from "@/modules/leads/constants";
import { formatPhone } from "@/modules/leads/phone";
import type { AssignableUser } from "@/modules/leads/service";

import { updateClientAction } from "../actions";
import { ASSOCIATIVE_STATUS_LABELS, ASSOCIATIVE_STATUSES } from "../constants";
import type { ClientDetail } from "../service";

import { AssociativeStatusBadge } from "./associative-status-badge";

export function ClientEditForm({ client, users }: { client: ClientDetail; users: AssignableUser[] }) {
  const [result, formAction, pending] = useActionState(updateClientAction, IDLE);
  const errors = result.fieldErrors ?? {};
  const values = result.status === "error" ? (result.values ?? {}) : {};
  const disabled = !client.canEdit;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>
          Última edição: <strong className="text-foreground">{formatDateTime(client.updatedAt)}</strong> por {client.updatedByName}
        </span>
        <AssociativeStatusBadge status={client.associativeStatus} />
      </div>

      {disabled && (
        <p className="text-sm text-muted-foreground">Somente o responsável, gestores e administradores podem editar este cliente.</p>
      )}

      {/* key: remonta com os dados novos do servidor ou com os valores devolvidos após erro */}
      <form key={`${client.updatedAt.toString()}|${JSON.stringify(values)}`} action={formAction} className="grid gap-4" noValidate>
        <FormFeedback result={result} />
        <input type="hidden" name="clientId" value={client.id} />
        <fieldset disabled={disabled || pending} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="client-name">Nome</Label>
            <Input id="client-name" name="name" defaultValue={values.name ?? client.name} maxLength={LEAD_NAME_MAX} aria-invalid={!!errors.name} aria-describedby="client-name-error" />
            <FieldError id="client-name-error" message={errors.name} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="client-email">E-mail</Label>
              <Input id="client-email" name="email" type="email" defaultValue={values.email ?? client.email} maxLength={254} aria-invalid={!!errors.email} aria-describedby="client-email-error" />
              <FieldError id="client-email-error" message={errors.email} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="client-phone">Telefone com DDD</Label>
              <Input id="client-phone" name="phone" type="tel" defaultValue={values.phone ?? formatPhone(client.phone)} maxLength={25} aria-invalid={!!errors.phone} aria-describedby="client-phone-error" />
              <FieldError id="client-phone-error" message={errors.phone} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="client-status">Status associativo</Label>
              <NativeSelect id="client-status" name="associativeStatus" defaultValue={values.associativeStatus ?? client.associativeStatus}>
                {ASSOCIATIVE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {ASSOCIATIVE_STATUS_LABELS[status]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="client-owner">Responsável</Label>
              {client.canAssign ? (
                <NativeSelect id="client-owner" name="ownerId" defaultValue={values.ownerId ?? client.ownerId}>
                  {!users.some((user) => user.id === client.ownerId) && <option value={client.ownerId}>{client.ownerName}</option>}
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </NativeSelect>
              ) : (
                <Input id="client-owner" value={client.ownerName} readOnly disabled />
              )}
            </div>
          </div>
          <Button type="submit" className="justify-self-start">
            {pending ? "Salvando…" : "Salvar"}
          </Button>
        </fieldset>
      </form>
    </div>
  );
}
