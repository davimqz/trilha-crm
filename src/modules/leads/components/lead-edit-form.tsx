"use client";

import { ArchiveIcon, ArchiveRestoreIcon, Trash2Icon } from "lucide-react";
import { useActionState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { FieldError, FormFeedback } from "@/components/form/form-feedback";
import { NativeSelect } from "@/components/form/native-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { IDLE } from "@/core/actions/action-state";
import { formatDateTime } from "@/lib/format";

import { deleteLeadAction, setArchivedAction, updateLeadAction } from "../actions";
import { LEAD_NAME_MAX, LEAD_STATUS_LABELS } from "../constants";
import { formatPhone } from "../phone";
import type { AssignableUser, LeadDetail } from "../service";

type LeadEditFormProps = {
  lead: LeadDetail;
  users: AssignableUser[];
  onDeleted: () => void;
};

export function LeadEditForm({ lead, users, onDeleted }: LeadEditFormProps) {
  const [result, formAction, pending] = useActionState(updateLeadAction, IDLE);
  const [busy, startTransition] = useTransition();
  const errors = result.fieldErrors ?? {};
  // Após erro, mostra o que foi digitado; senão, os dados atuais do lead
  const values = result.status === "error" ? (result.values ?? {}) : {};
  const disabled = !lead.canEdit;

  function toggleArchived() {
    startTransition(async () => {
      const response = await setArchivedAction(lead.id, !lead.archivedAt);
      if (response.status === "success") toast.success(response.message);
      else toast.error(response.message);
    });
  }

  function remove() {
    startTransition(async () => {
      const response = await deleteLeadAction(lead.id);
      if (response.status === "success") {
        toast.success(response.message);
        onDeleted();
      } else {
        toast.error(response.message);
      }
    });
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>
          Última edição: <strong className="text-foreground">{formatDateTime(lead.updatedAt)}</strong> por {lead.updatedByName}
        </span>
        <Badge variant="secondary">{LEAD_STATUS_LABELS[lead.status]}</Badge>
        {lead.archivedAt && <Badge variant="outline">Arquivado</Badge>}
      </div>

      {disabled && (
        <p className="text-sm text-muted-foreground">Somente o responsável, gestores e administradores podem editar este lead.</p>
      )}

      {/* key: remonta com os dados novos do servidor ou com os valores devolvidos após erro */}
      <form key={`${lead.updatedAt.toString()}|${JSON.stringify(values)}`} action={formAction} className="grid gap-4" noValidate>
        <FormFeedback result={result} />
        <input type="hidden" name="leadId" value={lead.id} />
        <fieldset disabled={disabled || pending} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-name">Nome</Label>
            <Input id="edit-name" name="name" defaultValue={values.name ?? lead.name} required maxLength={LEAD_NAME_MAX} aria-invalid={!!errors.name} aria-describedby="edit-name-error" />
            <FieldError id="edit-name-error" message={errors.name} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-email">E-mail</Label>
              <Input id="edit-email" name="email" type="email" defaultValue={values.email ?? lead.email} required maxLength={254} aria-invalid={!!errors.email} aria-describedby="edit-email-error" />
              <FieldError id="edit-email-error" message={errors.email} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-phone">Telefone com DDD</Label>
              <Input id="edit-phone" name="phone" type="tel" defaultValue={values.phone ?? formatPhone(lead.phone)} required maxLength={25} aria-invalid={!!errors.phone} aria-describedby="edit-phone-error" />
              <FieldError id="edit-phone-error" message={errors.phone} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Status só leitura: reflete a coluna atual do kanban (muda arrastando o card) */}
            <div className="grid gap-2">
              <Label htmlFor="edit-status">Status</Label>
              <Input id="edit-status" value={LEAD_STATUS_LABELS[lead.status]} readOnly disabled aria-describedby="edit-status-hint" />
              <p id="edit-status-hint" className="text-xs text-muted-foreground">
                Para mudar, arraste o card no kanban.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-owner">Responsável</Label>
              {lead.canAssign ? (
                <NativeSelect id="edit-owner" name="ownerId" defaultValue={values.ownerId ?? lead.ownerId}>
                  {!users.some((user) => user.id === lead.ownerId) && <option value={lead.ownerId}>{lead.ownerName}</option>}
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </NativeSelect>
              ) : (
                <Input id="edit-owner" value={lead.ownerName} readOnly disabled />
              )}
            </div>
          </div>
          <Button type="submit" className="justify-self-start">
            {pending ? "Salvando…" : "Salvar"}
          </Button>
        </fieldset>
      </form>

      {(lead.canArchive || lead.canDelete) && (
        <>
          <Separator />
          <div className="flex flex-wrap gap-2">
            {lead.canArchive && (
              <Button type="button" variant="outline" onClick={toggleArchived} disabled={busy}>
                {lead.archivedAt ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
                {lead.archivedAt ? "Desarquivar" : "Arquivar"}
              </Button>
            )}
            {lead.canDelete && (
              <ConfirmDialog
                trigger={
                  <Button type="button" variant="destructive" disabled={busy}>
                    <Trash2Icon />
                    Excluir
                  </Button>
                }
                title="Excluir lead?"
                description="Excluir este lead apaga também anotações e anexos. Esta ação não pode ser desfeita."
                confirmLabel="Excluir definitivamente"
                onConfirm={remove}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
