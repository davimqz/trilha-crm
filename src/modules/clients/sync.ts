import { eq } from "drizzle-orm";

import type { Transaction } from "@/core/db/create-database";
import type { LeadStatus } from "@/modules/leads/constants";
import { recordLeadEvents } from "@/modules/leads/events";

import { clients } from "./schema";

const CONVERTED: LeadStatus = "converted";

// Chamado pelo service de leads na MESMA transação da mudança de status (ADR-008).
// É a única forma de um cliente nascer: não existe criação manual.
export async function syncClientForStatusChange(
  tx: Transaction,
  change: { leadId: string; fromStatus: LeadStatus | null; toStatus: LeadStatus; actorId: string },
): Promise<void> {
  const { leadId, fromStatus, toStatus, actorId } = change;
  const enteringConverted = toStatus === CONVERTED && fromStatus !== CONVERTED;
  const leavingConverted = fromStatus === CONVERTED && toStatus !== CONVERTED;
  if (!enteringConverted && !leavingConverted) return;

  const [existing] = await tx
    .select({ id: clients.id, archivedAt: clients.archivedAt })
    .from(clients)
    .where(eq(clients.leadId, leadId))
    .for("update");
  const now = new Date();

  if (enteringConverted) {
    if (!existing) {
      await tx.insert(clients).values({ leadId, updatedBy: actorId, convertedAt: now });
      await recordLeadEvents(tx, [{ leadId, type: "converted", actorId }]);
    } else if (existing.archivedAt) {
      // Voltou para Convertido: reativa o MESMO cliente, com todo o histórico
      await tx
        .update(clients)
        .set({ archivedAt: null, updatedBy: actorId, updatedAt: now })
        .where(eq(clients.id, existing.id));
      await recordLeadEvents(tx, [{ leadId, type: "client_reactivated", actorId }]);
    }
    return;
  }

  if (existing && !existing.archivedAt) {
    await tx
      .update(clients)
      .set({ archivedAt: now, updatedBy: actorId, updatedAt: now })
      .where(eq(clients.id, existing.id));
    await recordLeadEvents(tx, [{ leadId, type: "conversion_reverted", actorId }]);
  }
}
