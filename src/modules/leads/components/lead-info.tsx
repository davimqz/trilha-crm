import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";

import { LEAD_STATUS_LABELS } from "../constants";
import { formatPhone } from "../phone";
import type { LeadDetail } from "../service";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm break-words">{children}</dd>
    </div>
  );
}

export function LeadInfo({ lead }: { lead: LeadDetail }) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      <Field label="Nome">{lead.name}</Field>
      <Field label="Status">
        <Badge variant="secondary">{LEAD_STATUS_LABELS[lead.status]}</Badge>
      </Field>
      <Field label="E-mail">
        <a href={`mailto:${lead.email}`} className="underline-offset-4 hover:underline">
          {lead.email}
        </a>
      </Field>
      <Field label="Telefone">
        <a href={`tel:+55${lead.phone}`} className="underline-offset-4 hover:underline">
          {formatPhone(lead.phone)}
        </a>
      </Field>
      <Field label="Responsável">{lead.ownerName}</Field>
      <Field label="Criado em">
        {formatDateTime(lead.createdAt)} por {lead.createdByName}
      </Field>
      <Field label="Última edição">
        {formatDateTime(lead.updatedAt)} por {lead.updatedByName}
      </Field>
      {lead.archivedAt && (
        <Field label="Arquivado">
          {formatDateTime(lead.archivedAt)}
          {lead.archivedByName ? ` por ${lead.archivedByName}` : ""}
        </Field>
      )}
    </dl>
  );
}
