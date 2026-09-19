import type { Transaction } from "@/core/db/create-database";

import type { LeadEventType } from "./constants";
import { leadEvents } from "./schema";

export type LeadEventInput = {
  leadId: string;
  type: LeadEventType;
  actorId: string;
  fromValue?: string | null;
  toValue?: string | null;
};

// Sempre chamado dentro da transação da ação: o evento só existe se a ação for confirmada (ADR-008)
export async function recordLeadEvents(tx: Transaction, events: LeadEventInput[]): Promise<void> {
  if (events.length === 0) return;
  await tx.insert(leadEvents).values(
    events.map((event) => ({
      leadId: event.leadId,
      type: event.type,
      actorId: event.actorId,
      fromValue: event.fromValue ?? null,
      toValue: event.toValue ?? null,
    })),
  );
}
