// Linha do tempo (ADR-008): função pura que junta eventos do lead, anotações, anexos e itens extras
// (ex.: atendimentos do cliente) em ordem cronológica. Sem dependências de servidor.
// Itens são concisos de propósito: só um rótulo curto ou "De X Para Y" (pedido do dono do produto).

import { LEAD_STATUS_LABELS, type LeadEventType, type LeadStatus } from "./constants";

export type TimelineKind = "event" | "note" | "attachment" | "service";

export type TimelineChange = { from: string; to: string };

export type TimelineItem = {
  id: string;
  at: Date;
  kind: TimelineKind;
  // Rótulo curto; com `change`, vira o prefixo (ex.: "Responsável") e pode faltar (mudança de status do lead)
  title?: string;
  change?: TimelineChange;
};

type EventLike = { id: string; type: LeadEventType; fromValue: string | null; toValue: string | null; createdAt: Date };
type NoteLike = { id: string; createdAt: Date };
type AttachmentLike = { id: string; createdAt: Date };

type EventSummary = Pick<TimelineItem, "title" | "change">;

const EXCERPT_MAX = 160;

const EVENT_TITLES: Partial<Record<LeadEventType, string>> = {
  created: "Lead criado",
  converted: "Convertido em cliente",
  conversion_reverted: "Conversão desfeita",
  client_reactivated: "Cliente reativado",
  archived: "Lead arquivado",
  unarchived: "Lead desarquivado",
  // Evento antigo (antes de separar por campo): continua aparecendo no histórico
  contact_updated: "Atualização de contato",
  name_updated: "Atualização de nome",
  email_updated: "Atualização de e-mail",
  phone_updated: "Atualização de telefone",
  birth_date_updated: "Atualização de data de nascimento",
  note_edited: "Anotação editada",
  note_deleted: "Anotação excluída",
  service_record_edited: "Atendimento editado",
  service_record_deleted: "Atendimento excluído",
};

function statusLabel(value: string | null): string {
  if (!value) return "—";
  return LEAD_STATUS_LABELS[value as LeadStatus] ?? value;
}

export function describeEvent(event: Pick<EventLike, "type" | "fromValue" | "toValue">): EventSummary {
  switch (event.type) {
    case "status_changed":
      return { change: { from: statusLabel(event.fromValue), to: statusLabel(event.toValue) } };
    case "owner_changed":
      return { title: "Responsável", change: { from: event.fromValue ?? "—", to: event.toValue ?? "—" } };
    case "associative_status_changed":
      return { title: "Status associativo", change: { from: event.fromValue ?? "—", to: event.toValue ?? "—" } };
    default:
      return { title: EVENT_TITLES[event.type] ?? "Evento" };
  }
}

// Usado ao gravar o trecho de uma anotação excluída no evento
export function excerpt(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > EXCERPT_MAX ? `${compact.slice(0, EXCERPT_MAX - 1)}…` : compact;
}

export function buildTimeline(sources: {
  events?: EventLike[];
  notes?: NoteLike[];
  attachments?: AttachmentLike[];
  extra?: TimelineItem[];
}): TimelineItem[] {
  const items: TimelineItem[] = [
    ...(sources.events ?? []).map((event) => ({
      id: `event-${event.id}`,
      at: new Date(event.createdAt),
      kind: "event" as const,
      ...describeEvent(event),
    })),
    ...(sources.notes ?? []).map((note) => ({
      id: `note-${note.id}`,
      at: new Date(note.createdAt),
      kind: "note" as const,
      title: "Anotação adicionada",
    })),
    ...(sources.attachments ?? []).map((attachment) => ({
      id: `attachment-${attachment.id}`,
      at: new Date(attachment.createdAt),
      kind: "attachment" as const,
      title: "Anexo adicionado",
    })),
    ...(sources.extra ?? []),
  ];
  // Mais recente primeiro; empate resolvido pelo id para a ordem ser estável
  return items.sort((a, b) => b.at.getTime() - a.at.getTime() || a.id.localeCompare(b.id));
}
