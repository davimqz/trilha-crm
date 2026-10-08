import { z } from "zod";

import { todayCivilDate } from "@/lib/format";

import {
  BIRTH_DATE_MIN,
  LEAD_CREATE_STATUSES,
  LEAD_NAME_MAX,
  LEAD_PERIODS,
  LEAD_SEARCH_MAX,
  LEAD_SORTS,
  LEAD_STATUSES,
} from "./constants";
import { normalizePhone } from "./phone";
import { richTextDocSchema } from "./rich-text";

const leadId = z.uuid("Lead inválido.");

export const leadNameSchema = z
  .string()
  .trim()
  .min(2, "Informe o nome (mínimo 2 caracteres).")
  .max(LEAD_NAME_MAX, `Nome muito longo (máximo ${LEAD_NAME_MAX} caracteres).`);

export const leadEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "E-mail muito longo.")
  .pipe(z.email("E-mail inválido."));

export const leadPhoneSchema = z.string().transform((value, context) => {
  const normalized = normalizePhone(value);
  if (!normalized) {
    context.addIssue({ code: "custom", message: "Telefone inválido. Informe DDD + número, ex.: (11) 91234-5678." });
    return z.NEVER;
  }
  return normalized;
});

function isRealCivilDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  // Rejeita datas que o Date "corrige" (ex.: 2026-02-30 → 02/03)
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

// Opcional: vazio/ausente vira null. Formato do <input type="date">: "AAAA-MM-DD"
export const leadBirthDateSchema = z
  .string()
  .trim()
  .optional()
  .transform((value, context) => {
    if (!value) return null;
    if (!isRealCivilDate(value)) {
      context.addIssue({ code: "custom", message: "Data de nascimento inválida." });
      return z.NEVER;
    }
    // Strings "AAAA-MM-DD" comparam na ordem cronológica
    if (value < BIRTH_DATE_MIN || value > todayCivilDate()) {
      context.addIssue({ code: "custom", message: "Data de nascimento fora do intervalo permitido." });
      return z.NEVER;
    }
    return value;
  });

const status = z.enum(LEAD_STATUSES, "Status inválido.");
const name = leadNameSchema;
const email = leadEmailSchema;
const phone = leadPhoneSchema;
const birthDate = leadBirthDateSchema;

// strictObject: ownerId, archivedAt, createdBy etc. nunca vêm do cliente
export const createLeadSchema = z.strictObject({
  name,
  email,
  phone,
  birthDate,
  status: z.enum(LEAD_CREATE_STATUSES, "Leads só podem ser cadastrados em Prospect ou Primeiro Contato."),
});

// Sem status: o estágio é a coluna do kanban e só muda pelo moveLead
export const updateLeadSchema = z.strictObject({
  leadId,
  name,
  email,
  phone,
  birthDate,
  // Só aplicado se o ator tiver `leads:assign` (checado no service)
  ownerId: z.uuid("Responsável inválido.").optional(),
});

export const moveLeadSchema = z.strictObject({ leadId, status });
export const setArchivedSchema = z.strictObject({ leadId, archived: z.boolean() });
export const leadIdSchema = z.strictObject({ leadId });

export const addNoteSchema = z.strictObject({ leadId, content: richTextDocSchema });
export const noteRefSchema = z.strictObject({ leadId, noteId: z.uuid("Anotação inválida.") });
export const updateNoteSchema = z.strictObject({ leadId, noteId: z.uuid("Anotação inválida."), content: richTextDocSchema });

export const attachmentRefSchema = z.strictObject({ leadId, attachmentId: z.uuid("Anexo inválido.") });

// Filtros vêm da URL: valores inválidos caem no padrão em vez de gerar erro
export const listLeadsSchema = z.object({
  q: z.string().trim().max(LEAD_SEARCH_MAX).catch("").default(""),
  owner: z.union([z.literal("all"), z.literal("me"), z.uuid()]).catch("all").default("all"),
  period: z.enum(LEAD_PERIODS).catch("any").default("any"),
  sort: z.enum(LEAD_SORTS).catch("updated_desc").default("updated_desc"),
  archived: z.boolean().catch(false).default(false),
});

export type ListLeadsInput = z.input<typeof listLeadsSchema>;
export type ListLeadsQuery = z.output<typeof listLeadsSchema>;
