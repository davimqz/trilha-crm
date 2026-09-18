"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { startTransition, useId, useOptimistic, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { moveLeadAction } from "../actions";
import { LEAD_STATUS_LABELS, LEAD_STATUSES, type LeadStatus } from "../constants";
import type { LeadCard as LeadCardData } from "../service";

import { CreateLeadDialog } from "./create-lead-dialog";
import { LeadCard } from "./lead-card";
import { useLeadsUrl } from "./use-leads-url";

type LeadsBoardProps = { leads: LeadCardData[]; canCreate: boolean; filtered: boolean };

const isStatus = (value: unknown): value is LeadStatus => LEAD_STATUSES.includes(value as LeadStatus);

function Column({
  status,
  leads,
  canCreate,
  hrefFor,
}: {
  status: LeadStatus;
  leads: LeadCardData[];
  canCreate: boolean;
  hrefFor: (leadId: string) => string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const titleId = `column-${status}`;

  return (
    <section
      ref={setNodeRef}
      aria-labelledby={titleId}
      data-testid={`column-${status}`}
      className={cn(
        "flex w-72 shrink-0 flex-col gap-2 rounded-xl bg-muted/50 p-2 transition-colors",
        isOver && "bg-muted ring-2 ring-ring/40",
      )}
    >
      <header className="flex items-center justify-between px-1 py-1">
        <h2 id={titleId} className="text-sm font-semibold">
          {LEAD_STATUS_LABELS[status]}
        </h2>
        <Badge variant="secondary" aria-label={`${leads.length} leads`}>
          {leads.length}
        </Badge>
      </header>
      <ul className="flex min-h-16 flex-col gap-2">
        {leads.map((lead) => (
          <li key={lead.id}>
            <LeadCard lead={lead} href={hrefFor(lead.id)} />
          </li>
        ))}
      </ul>
      {canCreate && <CreateLeadDialog status={status} />}
    </section>
  );
}

export function LeadsBoard({ leads, canCreate, filtered }: LeadsBoardProps) {
  const { hrefWith } = useLeadsUrl();
  // id estável entre servidor e client (o dnd-kit usa um contador global para os ids de acessibilidade)
  const dndId = useId();
  const [activeId, setActiveId] = useState<string | null>(null);
  // Atualização otimista: o card muda de coluna na hora e volta sozinho se a action falhar
  const [optimisticLeads, moveOptimistic] = useOptimistic(
    leads,
    (state, move: { id: string; status: LeadStatus }) =>
      state.map((lead) => (lead.id === move.id ? { ...lead, status: move.status } : lead)),
  );

  const sensors = useSensors(
    // Distância mínima: um clique no nome abre o card em vez de iniciar o arraste
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] } }),
  );

  const nameOf = (id: unknown) => optimisticLeads.find((lead) => lead.id === id)?.name ?? "lead";
  const columnOf = (id: unknown) => (isStatus(id) ? LEAD_STATUS_LABELS[id] : "fora das colunas");
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Movendo ${nameOf(active.id)}.`,
    onDragOver: ({ active, over }) => `${nameOf(active.id)} sobre ${columnOf(over?.id)}.`,
    onDragEnd: ({ active, over }) => `${nameOf(active.id)} solto em ${columnOf(over?.id)}.`,
    onDragCancel: ({ active }) => `Movimento de ${nameOf(active.id)} cancelado.`,
  };

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const leadId = String(event.active.id);
    const target = event.over?.id;
    const current = optimisticLeads.find((lead) => lead.id === leadId);
    if (!current || !isStatus(target) || current.status === target) return;

    startTransition(async () => {
      moveOptimistic({ id: leadId, status: target });
      const result = await moveLeadAction(leadId, target);
      if (result.status === "error") toast.error(result.message ?? "Não foi possível mover o lead.");
    });
  }

  const activeLead = optimisticLeads.find((lead) => lead.id === activeId);

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable: "Para mover, pressione espaço, use as setas para escolher a coluna e espaço novamente para soltar. Esc cancela.",
        },
      }}
    >
      {filtered && optimisticLeads.length === 0 && (
        <p className="mb-3 text-sm text-muted-foreground">Nenhum lead encontrado para os filtros atuais.</p>
      )}
      {!filtered && optimisticLeads.length === 0 && (
        <p className="mb-3 text-sm text-muted-foreground">
          Nenhum lead ainda.{canCreate ? " Use + em uma coluna para cadastrar." : ""}
        </p>
      )}
      <div className="flex gap-3 overflow-x-auto pb-4" data-testid="leads-board">
        {LEAD_STATUSES.map((status) => (
          <Column
            key={status}
            status={status}
            leads={optimisticLeads.filter((lead) => lead.status === status)}
            canCreate={canCreate}
            hrefFor={(leadId) => hrefWith({ lead: leadId, tab: null })}
          />
        ))}
      </div>
      <DragOverlay>{activeLead ? <LeadCard lead={activeLead} href="#" overlay /> : null}</DragOverlay>
    </DndContext>
  );
}
