"use client";

import { PencilIcon, Trash2Icon } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { FieldError } from "@/components/form/form-feedback";
import { NativeSelect } from "@/components/form/native-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/format";
import { RichTextEditor, type RichTextEditorHandle } from "@/modules/leads/components/rich-text-editor";
import { RichTextView } from "@/modules/leads/components/rich-text-view";
import type { AssignableUser } from "@/modules/leads/service";

import { addServiceRecordAction, deleteServiceRecordAction, updateServiceRecordAction } from "../actions";
import { SERVICE_RECORD_TYPE_LABELS, SERVICE_RECORD_TYPES, SERVICE_SUBJECT_MAX, type ServiceRecordType } from "../constants";
import type { ServiceRecord } from "../service";

type FormDefaults = {
  occurredAtLocal: string;
  type: ServiceRecordType;
  responsibleId: string;
  subject: string;
  description: ServiceRecord["description"];
};

// Data no fuso do navegador, no formato do <input type="datetime-local"> (só usado após interação: sem hidratação)
function toLocalInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

type ServiceRecordFormProps = {
  idPrefix: string;
  defaults: FormDefaults;
  maxLocal: string;
  users: AssignableUser[];
  submitLabel: string;
  onSubmit: (payload: Record<string, unknown>) => Promise<{ ok: boolean; fieldErrors?: Record<string, string> }>;
  onCancel?: () => void;
  testId?: string;
};

// Formulário reutilizado para registrar e editar atendimentos
function ServiceRecordForm({ idPrefix, defaults, maxLocal, users, submitLabel, onSubmit, onCancel, testId }: ServiceRecordFormProps) {
  const editorRef = useRef<RichTextEditorHandle>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formKey, setFormKey] = useState(0);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    const occurredLocal = String(formData.get("occurredAt") ?? "");
    const occurredAt = occurredLocal ? new Date(occurredLocal) : null;
    const editor = editorRef.current;
    startTransition(async () => {
      const result = await onSubmit({
        // datetime-local não tem fuso: converte no navegador (horário local do usuário) para ISO
        occurredAt: occurredAt && !Number.isNaN(occurredAt.getTime()) ? occurredAt.toISOString() : "",
        type: String(formData.get("type") ?? ""),
        subject: String(formData.get("subject") ?? ""),
        responsibleId: String(formData.get("responsibleId") ?? ""),
        description: editor && !editor.isEmpty() ? editor.getJSON() : null,
      });
      if (result.ok) {
        setErrors({});
        if (!onCancel) {
          editor?.clear();
          setFormKey((key) => key + 1);
        }
      } else {
        setErrors(result.fieldErrors ?? {});
      }
    });
  }

  return (
    <form key={formKey} action={submit} className="grid gap-3 rounded-lg border p-3" noValidate data-testid={testId}>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-occurred`}>Data e hora</Label>
          <Input id={`${idPrefix}-occurred`} name="occurredAt" type="datetime-local" defaultValue={defaults.occurredAtLocal} max={maxLocal} aria-invalid={!!errors.occurredAt} aria-describedby={`${idPrefix}-occurred-error`} />
          <FieldError id={`${idPrefix}-occurred-error`} message={errors.occurredAt} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-type`}>Tipo</Label>
          <NativeSelect id={`${idPrefix}-type`} name="type" defaultValue={defaults.type}>
            {SERVICE_RECORD_TYPES.map((type) => (
              <option key={type} value={type}>
                {SERVICE_RECORD_TYPE_LABELS[type]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-responsible`}>Responsável</Label>
          <NativeSelect id={`${idPrefix}-responsible`} name="responsibleId" defaultValue={defaults.responsibleId}>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-subject`}>Assunto</Label>
        <Input id={`${idPrefix}-subject`} name="subject" defaultValue={defaults.subject} maxLength={SERVICE_SUBJECT_MAX} aria-invalid={!!errors.subject} aria-describedby={`${idPrefix}-subject-error`} />
        <FieldError id={`${idPrefix}-subject-error`} message={errors.subject} />
      </div>
      <div className="grid gap-1.5">
        <span className="text-sm font-medium">Descrição (opcional)</span>
        <RichTextEditor ref={editorRef} label={`Descrição do atendimento${onCancel ? " (edição)" : ""}`} initialContent={defaults.description} disabled={pending} />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}

function ServiceRecordItem({ clientId, record, users, maxLocal }: { clientId: string; record: ServiceRecord; users: AssignableUser[]; maxLocal: string }) {
  const [editing, setEditing] = useState(false);
  const [removing, startTransition] = useTransition();

  async function save(payload: Record<string, unknown>) {
    const response = await updateServiceRecordAction({ ...payload, clientId, recordId: record.id });
    if (response.status === "success") {
      toast.success(response.message);
      setEditing(false);
      return { ok: true };
    }
    toast.error(Object.values(response.fieldErrors ?? {})[0] ?? response.message);
    return { ok: false, fieldErrors: response.fieldErrors };
  }

  function remove() {
    startTransition(async () => {
      const response = await deleteServiceRecordAction(clientId, record.id);
      if (response.status === "success") toast.success(response.message);
      else toast.error(response.message);
    });
  }

  if (editing) {
    return (
      <ServiceRecordForm
        idPrefix={`service-edit-${record.id}`}
        defaults={{
          occurredAtLocal: toLocalInput(new Date(record.occurredAt)),
          type: record.type,
          responsibleId: record.responsibleId,
          subject: record.subject,
          description: record.description,
        }}
        maxLocal={maxLocal}
        users={users}
        submitLabel="Salvar alterações"
        onSubmit={save}
        onCancel={() => setEditing(false)}
        testId="service-record-edit-form"
      />
    );
  }

  return (
    <article className="grid gap-2">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{SERVICE_RECORD_TYPE_LABELS[record.type]}</Badge>
          <h4 className="text-sm font-semibold">{record.subject}</h4>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">
            {formatDateTime(record.occurredAt)} · {record.responsibleName}
          </span>
          {record.canManage && (
            <>
              <Button type="button" variant="ghost" size="icon-xs" onClick={() => setEditing(true)} aria-label={`Editar atendimento ${record.subject}`} title="Editar" disabled={removing}>
                <PencilIcon />
              </Button>
              <ConfirmDialog
                trigger={
                  <Button type="button" variant="ghost" size="icon-xs" aria-label={`Excluir atendimento ${record.subject}`} title="Excluir" disabled={removing}>
                    <Trash2Icon />
                  </Button>
                }
                title="Excluir atendimento?"
                description="O atendimento será removido. A linha do tempo mantém o registro da exclusão."
                confirmLabel="Excluir"
                onConfirm={remove}
              />
            </>
          )}
        </div>
      </header>
      {record.description && <RichTextView doc={record.description} />}
      {record.updatedAt && (
        <p className="text-xs text-muted-foreground">
          Editado em {formatDateTime(record.updatedAt)}
          {record.updatedByName ? ` por ${record.updatedByName}` : ""}
        </p>
      )}
    </article>
  );
}

type ServiceRecordsProps = {
  clientId: string;
  records: ServiceRecord[];
  canLog: boolean;
  archived: boolean;
  users: AssignableUser[];
  currentUserId: string;
  // "AAAA-MM-DDTHH:mm" calculado no servidor (evita divergência de hidratação com "agora")
  nowLocal: string;
};

export function ServiceRecords({ clientId, records, canLog, archived, users, currentUserId, nowLocal }: ServiceRecordsProps) {
  async function create(payload: Record<string, unknown>) {
    const response = await addServiceRecordAction({ ...payload, clientId });
    if (response.status === "success") {
      toast.success(response.message);
      return { ok: true };
    }
    toast.error(Object.values(response.fieldErrors ?? {})[0] ?? response.message);
    return { ok: false, fieldErrors: response.fieldErrors };
  }

  return (
    <div className="grid gap-6">
      {canLog && !archived && (
        <ServiceRecordForm
          idPrefix="service"
          defaults={{ occurredAtLocal: nowLocal, type: "meeting", responsibleId: currentUserId, subject: "", description: null }}
          maxLocal={nowLocal}
          users={users}
          submitLabel="Registrar atendimento"
          onSubmit={create}
          testId="service-record-form"
        />
      )}
      {archived && <p className="text-sm text-muted-foreground">Cliente arquivado: novos atendimentos ficam bloqueados até a conversão ser refeita.</p>}

      <section aria-labelledby="services-history" className="grid gap-3">
        <h3 id="services-history" className="text-sm font-semibold">
          Atendimentos ({records.length})
        </h3>
        {records.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum atendimento registrado.</p>
        ) : (
          <ol className="grid gap-3">
            {records.map((record) => (
              <li key={record.id} className="rounded-lg border p-3" data-testid="service-record">
                <ServiceRecordItem clientId={clientId} record={record} users={users} maxLocal={nowLocal} />
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
