import { HistoryIcon, MessageSquareTextIcon, PaperclipIcon, PhoneCallIcon, type LucideIcon } from "lucide-react";

import { formatDateTime } from "@/lib/format";

import type { TimelineItem, TimelineKind } from "../timeline";

const KIND_ICONS: Record<TimelineKind, LucideIcon> = {
  event: HistoryIcon,
  note: MessageSquareTextIcon,
  attachment: PaperclipIcon,
  service: PhoneCallIcon,
};

function Summary({ item }: { item: TimelineItem }) {
  if (!item.change) return <>{item.title}</>;
  return (
    <>
      {item.title && <span className="text-muted-foreground">{item.title}: </span>}
      <span className="text-muted-foreground">De</span> <strong className="font-medium">{item.change.from}</strong>{" "}
      <span className="text-muted-foreground">Para</span> <strong className="font-medium">{item.change.to}</strong>
    </>
  );
}

// Linha do tempo compartilhada por lead e cliente (itens montados por buildTimeline no servidor).
// Data/hora à esquerda, resumo curto à direita.
export function TimelineView({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">Nenhum registro ainda.</p>;

  return (
    <ol className="grid gap-3" aria-label="Linha do tempo" data-testid="timeline">
      {items.map((item) => {
        const Icon = KIND_ICONS[item.kind];
        return (
          <li key={item.id} className="flex items-start gap-3" data-testid="timeline-item" data-kind={item.kind}>
            <time dateTime={new Date(item.at).toISOString()} className="w-32 shrink-0 pt-px text-xs text-muted-foreground tabular-nums">
              {formatDateTime(item.at)}
            </time>
            <Icon aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <p className="min-w-0 text-sm break-words">
              <Summary item={item} />
            </p>
          </li>
        );
      })}
    </ol>
  );
}
