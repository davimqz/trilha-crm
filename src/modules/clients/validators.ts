import { z } from "zod";

import { LEAD_SEARCH_MAX } from "@/modules/leads/constants";
import { richTextDocSchema } from "@/modules/leads/rich-text";
import { leadEmailSchema, leadNameSchema, leadPhoneSchema } from "@/modules/leads/validators";

import {
  ASSOCIATIVE_STATUSES,
  CLIENT_SORTS,
  SERVICE_RECORD_TYPES,
  SERVICE_SUBJECT_MAX,
  SERVICE_SUBJECT_MIN,
} from "./constants";

const clientId = z.uuid("Cliente inválido.");
const associativeStatus = z.enum(ASSOCIATIVE_STATUSES, "Status associativo inválido.");

// Tolerância para diferença de relógio entre navegador e servidor
const FUTURE_TOLERANCE_MS = 2 * 60 * 1000;

export const clientIdSchema = z.strictObject({ clientId });

// strictObject: leadId, archivedAt, convertedAt nunca vêm do cliente. Nome/e-mail/telefone são do lead (ADR-008)
export const updateClientSchema = z.strictObject({
  clientId,
  name: leadNameSchema,
  email: leadEmailSchema,
  phone: leadPhoneSchema,
  associativeStatus,
  ownerId: z.uuid("Responsável inválido.").optional(),
});

export const addServiceRecordSchema = z.strictObject({
  clientId,
  occurredAt: z.iso
    .datetime({ offset: true, message: "Data e hora inválidas." })
    .transform((value) => new Date(value))
    .refine((date) => date.getTime() <= Date.now() + FUTURE_TOLERANCE_MS, "A data do atendimento não pode ser no futuro.")
    .refine((date) => date.getFullYear() >= 2000, "Data do atendimento inválida."),
  type: z.enum(SERVICE_RECORD_TYPES, "Tipo de atendimento inválido."),
  subject: z
    .string()
    .trim()
    .min(SERVICE_SUBJECT_MIN, `Informe o assunto (mínimo ${SERVICE_SUBJECT_MIN} caracteres).`)
    .max(SERVICE_SUBJECT_MAX, `Assunto muito longo (máximo ${SERVICE_SUBJECT_MAX} caracteres).`),
  responsibleId: z.uuid("Responsável inválido."),
  // Mesmo schema seguro das anotações (ADR-007); descrição é opcional
  description: richTextDocSchema.nullable().optional(),
});

// Filtros vêm da URL: valores inválidos caem no padrão
export const listClientsSchema = z.object({
  q: z.string().trim().max(LEAD_SEARCH_MAX).catch("").default(""),
  owner: z.union([z.literal("all"), z.literal("me"), z.uuid()]).catch("all").default("all"),
  status: z.union([z.literal("all"), associativeStatus]).catch("all").default("all"),
  sort: z.enum(CLIENT_SORTS).catch("name_asc").default("name_asc"),
  archived: z.boolean().catch(false).default(false),
});

export type ListClientsQuery = z.output<typeof listClientsSchema>;
