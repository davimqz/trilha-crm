import { HistoryIcon, MessageSquareTextIcon, PaperclipIcon, PhoneCallIcon, type LucideIcon } from "lucide-react";

import { formatDateTime } from "@/lib/format";

import type { TimelineItem, TimelineKind } from "../timeline";

const KIND_ICONS: Record<TimelineKind, LucideIcon> = {
  event: HistoryIcon,
  note: MessageSquareTextIcon,
  attachment: PaperclipIcon,
  service: PhoneCallIcon,
};

// Linha do tempo compartilhada por lead e cliente (itens montados por buildTimeline no servidor)
export function TimelineView({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">Nenhum registro ainda.</p>;

  return (
    <ol className="relative grid gap-4 border-l pl-6" aria-label="Linha do tempo" data-testid="timeline">
      {items.map((item) => {
        const Icon = KIND_ICONS[item.kind];
        return (
          <li key={item.id} className="relative" data-testid="timeline-item" data-kind={item.kind}>
            <span className="absolute top-0.5 -left-[2.1rem] flex size-6 items-center justify-center rounded-full border bg-background">
              <Icon aria-hidden className="size-3.5 text-muted-foreground" />
            </span>
            <p className="text-sm font-medium">{item.title}</p>
            {item.description && <p className="text-sm text-muted-foreground break-words">{item.description}</p>}
            <p className="text-xs text-muted-foreground">
              <time dateTime={new Date(item.at).toISOString()}>{formatDateTime(item.at)}</time> · {item.actor}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
