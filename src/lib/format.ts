// Datas guardadas em UTC e exibidas no fuso de São Paulo (docs/specs/leads.md §5)
const TIME_ZONE = "America/Sao_Paulo";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" });
const timeFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
const shortFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit" });

// "18/09/2026 às 14:32"
export function formatDateTime(value: Date | string): string {
  const date = new Date(value);
  return `${dateFormatter.format(date)} às ${timeFormatter.format(date)}`;
}

// "18/09 14:32" (cards)
export function formatShortDateTime(value: Date | string): string {
  const date = new Date(value);
  return `${shortFormatter.format(date)} ${timeFormatter.format(date)}`;
}
