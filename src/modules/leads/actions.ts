"use server";

import { revalidatePath } from "next/cache";

import { formString, runAction, withSubmittedValues, type ActionResult } from "@/core/actions/action-result";
import { requireActor } from "@/core/auth/session";

import { getLeadsService } from "./service";

const LEADS_PATH = "/leads";

// Server Actions são endpoints públicos: sessão aqui; permissão, posse e validação no service.
// Argumentos que não são FormData também chegam do cliente e são tratados como não confiáveis.

async function run(operation: () => Promise<string>): Promise<ActionResult> {
  const result = await runAction(operation);
  if (result.status === "success") {
    revalidatePath(LEADS_PATH);
    // Mudanças de status podem criar/arquivar clientes, e contato/anotações/anexos são compartilhados (ADR-008)
    revalidatePath("/clients");
  }
  return result;
}

export async function createLeadAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireActor();
  const result = await run(async () => {
    await getLeadsService().createLead(actor, {
      name: formString(formData, "name"),
      email: formString(formData, "email"),
      phone: formString(formData, "phone"),
      status: formString(formData, "status"),
    });
    return "Lead cadastrado.";
  });
  return withSubmittedValues(result, formData, ["name", "email", "phone"]);
}

export async function updateLeadAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireActor();
  const ownerId = formString(formData, "ownerId");
  const result = await run(async () => {
    await getLeadsService().updateLead(actor, {
      leadId: formString(formData, "leadId"),
      name: formString(formData, "name"),
      email: formString(formData, "email"),
      phone: formString(formData, "phone"),
      status: formString(formData, "status"),
      ...(ownerId ? { ownerId } : {}),
    });
    return "Alterações salvas.";
  });
  return withSubmittedValues(result, formData, ["name", "email", "phone", "status", "ownerId"]);
}

export async function moveLeadAction(leadId: unknown, status: unknown): Promise<ActionResult> {
  const actor = await requireActor();
  return run(async () => {
    await getLeadsService().moveLead(actor, { leadId, status });
    return "Lead movido.";
  });
}

export async function setArchivedAction(leadId: unknown, archived: unknown): Promise<ActionResult> {
  const actor = await requireActor();
  return run(async () => {
    await getLeadsService().setArchived(actor, { leadId, archived });
    return archived === true ? "Lead arquivado." : "Lead desarquivado.";
  });
}

export async function deleteLeadAction(leadId: unknown): Promise<ActionResult> {
  const actor = await requireActor();
  return run(async () => {
    await getLeadsService().deleteLead(actor, { leadId });
    return "Lead excluído.";
  });
}

export async function addNoteAction(leadId: unknown, content: unknown): Promise<ActionResult> {
  const actor = await requireActor();
  return run(async () => {
    await getLeadsService().addNote(actor, { leadId, content });
    return "Anotação adicionada.";
  });
}

export async function removeAttachmentAction(leadId: unknown, attachmentId: unknown): Promise<ActionResult> {
  const actor = await requireActor();
  return run(async () => {
    await getLeadsService().removeAttachment(actor, { leadId, attachmentId });
    return "Anexo removido.";
  });
}

export async function updateNoteAction(leadId: unknown, noteId: unknown, content: unknown): Promise<ActionResult> {
  const actor = await requireActor();
  return run(async () => {
    await getLeadsService().updateNote(actor, { leadId, noteId, content });
    return "Anotação atualizada.";
  });
}

export async function deleteNoteAction(leadId: unknown, noteId: unknown): Promise<ActionResult> {
  const actor = await requireActor();
  return run(async () => {
    await getLeadsService().deleteNote(actor, { leadId, noteId });
    return "Anotação excluída.";
  });
}
