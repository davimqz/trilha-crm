"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

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

import { addServiceRecordAction } from "../actions";
import { SERVICE_RECORD_TYPE_LABELS, SERVICE_RECORD_TYPES, SERVICE_SUBJECT_MAX } from "../constants";
import type { ServiceRecord } from "../service";

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
  const formRef = useRef<HTMLFormElement>(null);
  const editorRef = useRef<RichTextEditorHandle>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formKey, setFormKey] = useState(0);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    const occurredLocal = String(formData.get("occurredAt") ?? "");
    const occurredAt = occurredLocal ? new Date(occurredLocal) : null;
    const editor = editorRef.current;
    const description = editor && !editor.isEmpty() ? editor.getJSON() : null;

    startTransition(async () => {
      const response = await addServiceRecordAction({
        clientId,
        // datetime-local não tem fuso: converte no navegador (horário local do usuário) para ISO
        occurredAt: occurredAt && !Number.isNaN(occurredAt.getTime()) ? occurredAt.toISOString() : "",
        type: String(formData.get("type") ?? ""),
        subject: String(formData.get("subject") ?? ""),
        responsibleId: String(formData.get("responsibleId") ?? ""),
        description,
      });
      if (response.status === "success") {
        toast.success(response.message);
        setErrors({});
        editor?.clear();
        setFormKey((key) => key + 1);
      } else {
        setErrors(response.fieldErrors ?? {});
        toast.error(Object.values(response.fieldErrors ?? {})[0] ?? response.message);
      }
    });
  }

  return (
    <div className="grid gap-6">
      {canLog && !archived && (
        <form key={formKey} ref={formRef} action={submit} className="grid gap-3 rounded-lg border p-3" noValidate data-testid="service-record-form">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="service-occurred">Data e hora</Label>
              <Input id="service-occurred" name="occurredAt" type="datetime-local" defaultValue={nowLocal} max={nowLocal} aria-invalid={!!errors.occurredAt} aria-describedby="service-occurred-error" />
              <FieldError id="service-occurred-error" message={errors.occurredAt} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="service-type">Tipo</Label>
              <NativeSelect id="service-type" name="type" defaultValue="meeting">
                {SERVICE_RECORD_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {SERVICE_RECORD_TYPE_LABELS[type]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="service-responsible">Responsável</Label>
              <NativeSelect id="service-responsible" name="responsibleId" defaultValue={currentUserId}>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="service-subject">Assunto</Label>
            <Input id="service-subject" name="subject" maxLength={SERVICE_SUBJECT_MAX} aria-invalid={!!errors.subject} aria-describedby="service-subject-error" />
            <FieldError id="service-subject-error" message={errors.subject} />
          </div>
          <div className="grid gap-1.5">
            <span className="text-sm font-medium">Descrição (opcional)</span>
            <RichTextEditor ref={editorRef} label="Descrição do atendimento" disabled={pending} />
          </div>
          <Button type="submit" disabled={pending} className="justify-self-start">
            {pending ? "Registrando…" : "Registrar atendimento"}
          </Button>
        </form>
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
                <article className="grid gap-2">
                  <header className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{SERVICE_RECORD_TYPE_LABELS[record.type]}</Badge>
                      <h4 className="text-sm font-semibold">{record.subject}</h4>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(record.occurredAt)} · {record.responsibleName}
                    </span>
                  </header>
                  {record.description && <RichTextView doc={record.description} />}
                </article>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
