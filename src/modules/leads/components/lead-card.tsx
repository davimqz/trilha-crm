"use client";

import { useDndMonitor, useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon, MailIcon, PhoneIcon, UserIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, type KeyboardEvent, type MouseEvent } from "react";

import { Card } from "@/components/ui/card";
import { formatShortDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

import { formatPhone } from "../phone";
import type { LeadCard as LeadCardData } from "../service";

type LeadCardProps = { lead: LeadCardData; href: string; overlay?: boolean };

// Clique em qualquer parte do card abre o painel. Quem pode editar também arrasta: o arraste só começa
// depois de o ponteiro andar alguns pixels (PointerSensor no board), então um clique simples não arrasta.
export function LeadCard({ lead, href, overlay = false }: LeadCardProps) {
  const router = useRouter();
  const draggable = lead.canEdit && !overlay;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    disabled: !draggable,
    data: { status: lead.status },
  });

  // O navegador dispara um "click" ao soltar o card depois de arrastar. O monitor do dnd-kit marca o fim do
  // arraste de forma síncrona (antes desse click); um useEffect rodaria tarde demais.
  const dragEndedAt = useRef(0);
  const markDragEnd = ({ active }: { active: { id: string | number } }) => {
    if (active.id === lead.id) dragEndedAt.current = Date.now();
  };
  useDndMonitor({ onDragEnd: markDragEnd, onDragCancel: markDragEnd });

  function open(event?: MouseEvent) {
    if (overlay || isDragging || Date.now() - dragEndedAt.current < 250) return;
    // Ctrl/Cmd/Shift + clique no nome abre em nova aba (comportamento nativo do link); não abre o painel aqui
    if (event && (event.ctrlKey || event.metaKey || event.shiftKey)) return;
    router.push(href, { scroll: false });
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // Enter abre; Espaço fica para o arraste por teclado quando o card é arrastável
    if (event.key === "Enter" || (!draggable && event.key === " ")) {
      event.preventDefault();
      open();
      return;
    }
    if (draggable) listeners?.onKeyDown?.(event);
  }

  return (
    <Card
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        "cursor-pointer gap-1.5 p-3 text-sm shadow-xs transition-colors hover:ring-2 hover:ring-ring/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        draggable && "active:cursor-grabbing",
        isDragging && "opacity-40",
        overlay && "rotate-2 shadow-lg",
      )}
      data-testid={`lead-card-${lead.email}`}
      {...(draggable ? { ...attributes, ...listeners, "aria-roledescription": "card arrastável" } : {})}
      // Depois do spread do dnd-kit: estes valem também para cards não arrastáveis
      role="button"
      tabIndex={overlay ? -1 : 0}
      aria-label={`Abrir lead ${lead.name}`}
      onClick={open}
      onKeyDown={onKeyDown}
    >
      <div className="flex items-start justify-between gap-2">
        {/* Link mantido para abrir em nova aba (Ctrl/botão do meio); o clique normal é tratado pelo card */}
        <Link
          href={href}
          scroll={false}
          tabIndex={-1}
          className="font-medium leading-snug underline-offset-4 hover:underline"
          onClick={(event) => {
            if (!event.ctrlKey && !event.metaKey && !event.shiftKey) event.preventDefault();
          }}
        >
          {lead.name}
        </Link>
        {draggable && <GripVerticalIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />}
      </div>
      <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
        <MailIcon aria-hidden className="size-3" /> {lead.email}
      </p>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <PhoneIcon aria-hidden className="size-3" /> {formatPhone(lead.phone)}
      </p>
      <div className="flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1 truncate">
          <UserIcon aria-hidden className="size-3" /> {lead.ownerName}
        </span>
        <span title="Última atualização">{formatShortDateTime(lead.updatedAt)}</span>
      </div>
    </Card>
  );
}
