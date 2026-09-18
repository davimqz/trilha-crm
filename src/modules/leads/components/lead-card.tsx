"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon, MailIcon, PhoneIcon, UserIcon } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { formatShortDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

import { formatPhone } from "../phone";
import type { LeadCard as LeadCardData } from "../service";

type LeadCardProps = { lead: LeadCardData; href: string; overlay?: boolean };

// O card inteiro arrasta (quando o usuário pode editar); o nome é o link que abre o painel
export function LeadCard({ lead, href, overlay = false }: LeadCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    disabled: !lead.canEdit || overlay,
    data: { status: lead.status },
  });

  return (
    <Card
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        "gap-1.5 p-3 text-sm shadow-xs",
        lead.canEdit && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40",
        overlay && "rotate-2 shadow-lg",
      )}
      data-testid={`lead-card-${lead.email}`}
      {...(lead.canEdit && !overlay ? { ...attributes, ...listeners, "aria-roledescription": "card arrastável" } : {})}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={href}
          scroll={false}
          className="font-medium leading-snug underline-offset-4 hover:underline"
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {lead.name}
        </Link>
        {lead.canEdit && <GripVerticalIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />}
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
