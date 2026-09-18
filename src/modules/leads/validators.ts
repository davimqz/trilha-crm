import { z } from "zod";

import {
  LEAD_NAME_MAX,
  LEAD_PERIODS,
  LEAD_SEARCH_MAX,
  LEAD_SORTS,
  LEAD_STATUSES,
} from "./constants";
import { normalizePhone } from "./phone";
import { richTextDocSchema } from "./rich-text";

const leadId = z.uuid("Lead inválido.");

const name = z
  .string()
  .trim()
  .min(2, "Informe o nome (mínimo 2 caracteres).")
  .max(LEAD_NAME_MAX, `Nome muito longo (máximo ${LEAD_NAME_MAX} caracteres).`);

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "E-mail muito longo.")
  .pipe(z.email("E-mail inválido."));

const phone = z.string().transform((value, context) => {
  const normalized = normalizePhone(value);
  if (!normalized) {
    context.addIssue({ code: "custom", message: "Telefone inválido. Informe DDD + número, ex.: (11) 91234-5678." });
    return z.NEVER;
  }
  return normalized;
});

const status = z.enum(LEAD_STATUSES, "Status inválido.");

// strictObject: ownerId, archivedAt, createdBy etc. nunca vêm do cliente
export const createLeadSchema = z.strictObject({ name, email, phone, status });

export const updateLeadSchema = z.strictObject({
  leadId,
  name,
  email,
  phone,
  status,
  // Só aplicado se o ator tiver `leads:assign` (checado no service)
  ownerId: z.uuid("Responsável inválido.").optional(),
});

export const moveLeadSchema = z.strictObject({ leadId, status });
export const setArchivedSchema = z.strictObject({ leadId, archived: z.boolean() });
export const leadIdSchema = z.strictObject({ leadId });

export const addNoteSchema = z.strictObject({ leadId, content: richTextDocSchema });

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
