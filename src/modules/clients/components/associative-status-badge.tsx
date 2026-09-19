import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { ASSOCIATIVE_STATUS_LABELS, type AssociativeStatus } from "../constants";

export function AssociativeStatusBadge({ status }: { status: AssociativeStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5",
        status === "adimplente"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
          : "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", status === "adimplente" ? "bg-emerald-500" : "bg-red-500")} />
      {ASSOCIATIVE_STATUS_LABELS[status]}
    </Badge>
  );
}
