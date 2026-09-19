// Linha do tempo (ADR-008): função pura que junta eventos do lead, anotações, anexos e itens extras
// (ex.: atendimentos do cliente) em ordem cronológica. Sem dependências de servidor.

import { LEAD_STATUS_LABELS, type LeadEventType, type LeadStatus } from "./constants";
import { plainText, type RichTextDoc } from "./rich-text";

export type TimelineKind = "event" | "note" | "attachment" | "service";

export type TimelineItem = {
  id: string;
  at: Date;
  kind: TimelineKind;
  title: string;
  description?: string;
  actor: string;
};

type EventLike = { id: string; type: LeadEventType; fromValue: string | null; toValue: string | null; actorName: string; createdAt: Date };
type NoteLike = { id: string; content: RichTextDoc; authorName: string; createdAt: Date };
type AttachmentLike = { id: string; fileName: string; uploadedByName: string; createdAt: Date };

const EXCERPT_MAX = 160;

function statusLabel(value: string | null): string {
  if (!value) return "—";
  return LEAD_STATUS_LABELS[value as LeadStatus] ?? value;
}

export function eventTitle(event: Pick<EventLike, "type" | "fromValue" | "toValue">): string {
  switch (event.type) {
    case "created":
      return event.toValue ? `Virou lead em ${statusLabel(event.toValue)}` : "Virou lead";
    case "status_changed":
      return `Movido de ${statusLabel(event.fromValue)} para ${statusLabel(event.toValue)}`;
    case "converted":
      return "Convertido em cliente";
    case "conversion_reverted":
      return "Conversão desfeita — cliente arquivado";
    case "client_reactivated":
      return "Cliente reativado";
    case "archived":
      return "Lead arquivado";
    case "unarchived":
      return "Lead desarquivado";
    case "owner_changed":
      return `Responsável alterado de ${event.fromValue ?? "—"} para ${event.toValue ?? "—"}`;
    case "contact_updated":
      return "Dados de contato atualizados";
    case "associative_status_changed":
      return `Status associativo: ${event.fromValue ?? "—"} → ${event.toValue ?? "—"}`;
    case "note_edited":
      return "Anotação editada";
    case "note_deleted":
      return "Anotação excluída";
    case "service_record_edited":
      return `Atendimento editado: ${event.toValue ?? "—"}`;
    case "service_record_deleted":
      return `Atendimento excluído: ${event.fromValue ?? "—"}`;
    default:
      return "Evento";
  }
}

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
      title: eventTitle(event),
      // Anotação excluída: mostra o trecho do texto apagado
      description: event.type === "note_deleted" && event.fromValue ? event.fromValue : undefined,
      actor: event.actorName,
    })),
    ...(sources.notes ?? []).map((note) => ({
      id: `note-${note.id}`,
      at: new Date(note.createdAt),
      kind: "note" as const,
      title: "Anotação adicionada",
      description: excerpt(plainText(note.content)),
      actor: note.authorName,
    })),
    ...(sources.attachments ?? []).map((attachment) => ({
      id: `attachment-${attachment.id}`,
      at: new Date(attachment.createdAt),
      kind: "attachment" as const,
      title: `Anexo adicionado: ${attachment.fileName}`,
      actor: attachment.uploadedByName,
    })),
    ...(sources.extra ?? []),
  ];
  // Mais recente primeiro; empate resolvido pelo id para a ordem ser estável
  return items.sort((a, b) => b.at.getTime() - a.at.getTime() || a.id.localeCompare(b.id));
}
