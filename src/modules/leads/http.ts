import "server-only";

import { getCurrentActor } from "@/core/auth/session";
import { getEnv } from "@/core/env";
import { DomainError, NotFoundError } from "@/core/errors";
import { ForbiddenError } from "@/core/rbac/authorization";

import { ATTACHMENT_MAX_BYTES } from "./constants";
import { previewTypeOf } from "./file-types";
import { getLeadsService } from "./service";

// Handlers HTTP de anexos (route handlers não têm a checagem de origem automática das Server Actions)

const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

function json(status: number, message: string) {
  return Response.json({ message }, { status, headers: { "Cache-Control": "no-store" } });
}

function isSameOrigin(request: Request): boolean {
  const expected = new URL(getEnv().BETTER_AUTH_URL).origin;
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return false;
  return origin === expected;
}

function errorResponse(error: unknown) {
  if (error instanceof ForbiddenError) return json(403, error.message);
  if (error instanceof NotFoundError) return json(404, error.message);
  if (error instanceof DomainError) return json(400, error.message);
  if (error instanceof Error && error.name === "ZodError") return json(400, "Requisição inválida.");
  console.error("[leads/attachments] erro inesperado", error);
  return json(500, "Não foi possível concluir a operação.");
}

export async function handleAttachmentUpload(request: Request, leadId: string): Promise<Response> {
  if (!isSameOrigin(request)) return json(403, "Origem não permitida.");

  const actor = await getCurrentActor();
  if (!actor) return json(401, "Sessão expirada. Entre novamente.");

  // Recusa antes de ler o corpo: evita bufferizar uploads enormes
  const declaredLength = Number(request.headers.get("content-length"));
  if (!Number.isFinite(declaredLength) || declaredLength <= 0) return json(411, "Tamanho do envio não informado.");
  if (declaredLength > ATTACHMENT_MAX_BYTES + MULTIPART_OVERHEAD_BYTES) {
    return json(413, "O arquivo passa do limite de 10 MB.");
  }

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return json(400, "Envio inválido.");
  }
  if (!(file instanceof File)) return json(400, "Selecione um arquivo.");

  try {
    const attachment = await getLeadsService().addAttachment(actor, {
      leadId,
      fileName: file.name,
      data: new Uint8Array(await file.arrayBuffer()),
    });
    return Response.json({ id: attachment.id }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

// RFC 6266: nome ASCII de fallback + nome UTF-8 codificado
function contentDisposition(type: "attachment" | "inline", fileName: string): string {
  const fallback = fileName.normalize("NFKD").replace(/[^\x20-\x7e]/g, "").replace(/["\\]/g, "") || "arquivo";
  return `${type}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function handleAttachmentDownload(leadId: string, attachmentId: string): Promise<Response> {
  const actor = await getCurrentActor();
  if (!actor) return json(401, "Sessão expirada. Entre novamente.");

  try {
    const file = await getLeadsService().getAttachmentFile(actor, { leadId, attachmentId });
    return new Response(new Uint8Array(file.data), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(file.data.byteLength),
        // Sempre download: o navegador nunca renderiza o arquivo no contexto do CRM
        "Content-Disposition": contentDisposition("attachment", file.fileName),
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// Pré-visualização (inline) só para PDF, imagem e texto. Pode ser exibida apenas dentro do próprio CRM
// (frame-ancestors 'self'). Imagem e texto ficam em sandbox; o PDF não, porque o visualizador de PDF do Chrome
// não abre com CSP sandbox. O conteúdo já foi validado pela assinatura no upload e o MIME vem da allowlist.
export async function handleAttachmentPreview(leadId: string, attachmentId: string): Promise<Response> {
  const actor = await getCurrentActor();
  if (!actor) return json(401, "Sessão expirada. Entre novamente.");

  try {
    const file = await getLeadsService().getAttachmentFile(actor, { leadId, attachmentId });
    const previewType = previewTypeOf(file.kind);
    if (!previewType) return json(415, "Este tipo de arquivo não pode ser visualizado. Use Baixar.");

    const csp =
      previewType === "pdf"
        ? "default-src 'none'; frame-ancestors 'self'"
        : "default-src 'none'; frame-ancestors 'self'; sandbox";

    return new Response(new Uint8Array(file.data), {
      headers: {
        // Texto sempre como text/plain: um .csv/.txt com HTML nunca é renderizado como página
        "Content-Type": previewType === "text" ? "text/plain; charset=utf-8" : file.mimeType,
        "Content-Length": String(file.data.byteLength),
        "Content-Disposition": contentDisposition("inline", file.fileName),
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "SAMEORIGIN",
        "Content-Security-Policy": csp,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
