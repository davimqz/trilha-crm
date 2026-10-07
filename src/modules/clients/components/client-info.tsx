import { formatCivilDate, formatDateTime } from "@/lib/format";
import { formatPhone } from "@/modules/leads/phone";

import type { ClientDetail } from "../service";

import { AssociativeStatusBadge } from "./associative-status-badge";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm break-words">{children}</dd>
    </div>
  );
}

export function ClientInfo({ client }: { client: ClientDetail }) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      <Field label="Nome">{client.name}</Field>
      <Field label="Status associativo">
        <AssociativeStatusBadge status={client.associativeStatus} />
      </Field>
      <Field label="E-mail">
        <a href={`mailto:${client.email}`} className="underline-offset-4 hover:underline">
          {client.email}
        </a>
      </Field>
      <Field label="Telefone">
        <a href={`tel:+55${client.phone}`} className="underline-offset-4 hover:underline">
          {formatPhone(client.phone)}
        </a>
      </Field>
      <Field label="Data de nascimento">{client.birthDate ? formatCivilDate(client.birthDate) : "—"}</Field>
      <Field label="Responsável">{client.ownerName}</Field>
      <Field label="Cliente desde">{formatDateTime(client.convertedAt)}</Field>
      <Field label="Última edição">
        {formatDateTime(client.updatedAt)} por {client.updatedByName}
      </Field>
      {client.archivedAt && <Field label="Arquivado">{formatDateTime(client.archivedAt)} — conversão desfeita no kanban de Leads</Field>}
    </dl>
  );
}
