// Constantes do módulo compartilhadas entre servidor e client (sem dependências de servidor)

export const ASSOCIATIVE_STATUSES = ["adimplente", "inadimplente"] as const;
export type AssociativeStatus = (typeof ASSOCIATIVE_STATUSES)[number];

export const ASSOCIATIVE_STATUS_LABELS: Record<AssociativeStatus, string> = {
  adimplente: "Adimplente",
  inadimplente: "Inadimplente",
};

export const SERVICE_RECORD_TYPES = ["meeting", "call", "whatsapp", "email", "in_person"] as const;
export type ServiceRecordType = (typeof SERVICE_RECORD_TYPES)[number];

export const SERVICE_RECORD_TYPE_LABELS: Record<ServiceRecordType, string> = {
  meeting: "Reunião",
  call: "Ligação",
  whatsapp: "WhatsApp",
  email: "E-mail",
  in_person: "Presencial",
};

export const CLIENT_SORTS = ["name_asc", "name_desc", "converted_desc", "converted_asc", "updated_desc"] as const;
export type ClientSort = (typeof CLIENT_SORTS)[number];

export const CLIENT_SORT_LABELS: Record<ClientSort, string> = {
  name_asc: "Nome (A–Z)",
  name_desc: "Nome (Z–A)",
  converted_desc: "Convertidos recentemente",
  converted_asc: "Convertidos há mais tempo",
  updated_desc: "Atualizados recentemente",
};

export const CLIENT_TABS = ["info", "edit", "notes", "attachments", "services", "timeline"] as const;
export type ClientTab = (typeof CLIENT_TABS)[number];

export const SERVICE_SUBJECT_MIN = 3;
export const SERVICE_SUBJECT_MAX = 150;
