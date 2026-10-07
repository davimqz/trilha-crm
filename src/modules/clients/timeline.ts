// Converte atendimentos em itens da linha do tempo (sem dependências de servidor)

import type { TimelineItem } from "@/modules/leads/timeline";

type ServiceRecordLike = { id: string; occurredAt: Date };

export function serviceRecordsToTimeline(records: ServiceRecordLike[]): TimelineItem[] {
  return records.map((record) => ({
    id: `service-${record.id}`,
    at: new Date(record.occurredAt),
    kind: "service",
    title: "Atendimento registrado",
  }));
}
