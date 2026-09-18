// Constantes do módulo compartilhadas entre servidor e client (sem dependências de servidor)

export const LEAD_STATUSES = [
  "prospect",
  "first_contact",
  "meeting_scheduled",
  "meeting_cancelled",
  "meeting_done",
  "converted",
  "not_converted",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  prospect: "Prospect",
  first_contact: "Primeiro Contato",
  meeting_scheduled: "Reunião Agendada",
  meeting_cancelled: "Reunião Desmarcada",
  meeting_done: "Reunião Realizada",
  converted: "Convertido",
  not_converted: "Não convertido",
};

// Abas do painel do lead (valor do parâmetro ?tab= na URL)
export const LEAD_TABS = ["info", "edit", "notes", "attachments"] as const;
export type LeadTab = (typeof LEAD_TABS)[number];

export const LEAD_SORTS = ["updated_desc", "created_desc", "created_asc", "name_asc", "name_desc"] as const;
export type LeadSort = (typeof LEAD_SORTS)[number];

export const LEAD_SORT_LABELS: Record<LeadSort, string> = {
  updated_desc: "Atualizados recentemente",
  created_desc: "Criados recentemente",
  created_asc: "Mais antigos",
  name_asc: "Nome (A–Z)",
  name_desc: "Nome (Z–A)",
};

export const LEAD_PERIODS = ["any", "7d", "30d", "90d"] as const;
export type LeadPeriod = (typeof LEAD_PERIODS)[number];

export const LEAD_PERIOD_LABELS: Record<LeadPeriod, string> = {
  any: "Qualquer data",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
};

export const LEAD_NAME_MAX = 120;
export const LEAD_SEARCH_MAX = 100;

export const NOTE_TEXT_MAX = 10_000;

// Paleta fixa de cores do editor (ADR-007): só estes valores são aceitos no servidor
export const NOTE_COLORS = [
  { label: "Padrão", value: null },
  { label: "Cinza", value: "#6b7280" },
  { label: "Vermelho", value: "#dc2626" },
  { label: "Laranja", value: "#ea580c" },
  { label: "Verde", value: "#16a34a" },
  { label: "Azul", value: "#2563eb" },
  { label: "Roxo", value: "#9333ea" },
  { label: "Rosa", value: "#db2777" },
] as const;

export const NOTE_COLOR_VALUES: readonly string[] = NOTE_COLORS.flatMap((color) => (color.value ? [color.value] : []));

export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const ATTACHMENTS_PER_LEAD_MAX = 20;
