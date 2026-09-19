// Converte atendimentos em itens da linha do tempo (sem dependências de servidor)

import { excerpt, type TimelineItem } from "@/modules/leads/timeline";
import { plainText, type RichTextDoc } from "@/modules/leads/rich-text";

import { SERVICE_RECORD_TYPE_LABELS, type ServiceRecordType } from "./constants";

type ServiceRecordLike = {
  id: string;
  occurredAt: Date;
  type: ServiceRecordType;
  subject: string;
  description: RichTextDoc | null;
  responsibleName: string;
};

export function serviceRecordsToTimeline(records: ServiceRecordLike[]): TimelineItem[] {
  return records.map((record) => ({
    id: `service-${record.id}`,
    at: new Date(record.occurredAt),
    kind: "service",
    title: `Atendimento (${SERVICE_RECORD_TYPE_LABELS[record.type]}): ${record.subject}`,
    description: record.description ? excerpt(plainText(record.description)) : undefined,
    actor: record.responsibleName,
  }));
}
