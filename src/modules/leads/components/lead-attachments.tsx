"use client";

import { DownloadIcon, EyeIcon, PaperclipIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ChangeEvent } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatShortDateTime } from "@/lib/format";

import { removeAttachmentAction } from "../actions";
import { ATTACHMENT_MAX_BYTES, ATTACHMENTS_PER_LEAD_MAX } from "../constants";
import { ACCEPTED_EXTENSIONS, ATTACHMENT_KINDS, formatFileSize, previewTypeOf } from "../file-types";
import type { LeadAttachment } from "../service";

import { AttachmentPreviewDialog, attachmentUrls } from "./attachment-preview-dialog";

type LeadAttachmentsProps = { leadId: string; attachments: LeadAttachment[]; canEdit: boolean };

export function LeadAttachments({ leadId, attachments, canEdit }: LeadAttachmentsProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, startTransition] = useTransition();
  const [previewing, setPreviewing] = useState<LeadAttachment | null>(null);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    // Checagem antecipada só para UX; o servidor valida tamanho e conteúdo de novo
    if (file.size > ATTACHMENT_MAX_BYTES) {
      toast.error("O arquivo passa do limite de 10 MB.");
      return;
    }

    setUploading(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch(`/api/leads/${leadId}/attachments`, { method: "POST", body });
      if (response.ok) {
        toast.success("Anexo adicionado.");
        router.refresh();
      } else {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        toast.error(payload?.message ?? "Não foi possível anexar o arquivo.");
      }
    } catch {
      toast.error("Falha de conexão ao enviar o arquivo.");
    } finally {
      setUploading(false);
    }
  }

  function remove(attachmentId: string) {
    startTransition(async () => {
      const response = await removeAttachmentAction(leadId, attachmentId);
      if (response.status === "success") toast.success(response.message);
      else toast.error(response.message);
    });
  }

  const limitReached = attachments.length >= ATTACHMENTS_PER_LEAD_MAX;

  return (
    <div className="grid gap-4">
      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            accept={ACCEPTED_EXTENSIONS.join(",")}
            onChange={upload}
            aria-label="Selecionar arquivo para anexar"
            data-testid="attachment-input"
          />
          <Button type="button" onClick={() => inputRef.current?.click()} disabled={uploading || limitReached}>
            <PlusIcon />
            {uploading ? "Enviando…" : "Adicionar"}
          </Button>
          <p className="text-xs text-muted-foreground">
            PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, TXT ou CSV · até 10 MB · máximo de {ATTACHMENTS_PER_LEAD_MAX} anexos
          </p>
        </div>
      )}

      {attachments.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <PaperclipIcon className="size-4" /> Nenhum anexo.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Tamanho</TableHead>
              <TableHead>Data do anexo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attachments.map((attachment) => (
              <TableRow key={attachment.id} data-testid="attachment-row">
                <TableCell className="max-w-56 truncate font-medium" title={attachment.fileName}>
                  {attachment.fileName}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{ATTACHMENT_KINDS[attachment.kind].label}</Badge>
                </TableCell>
                <TableCell>{formatFileSize(attachment.sizeBytes)}</TableCell>
                <TableCell className="whitespace-nowrap" title={attachment.uploadedByName}>
                  {formatShortDateTime(attachment.createdAt)}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {previewTypeOf(attachment.kind) ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setPreviewing(attachment)}
                      aria-label={`Visualizar ${attachment.fileName}`}
                      title="Visualizar"
                    >
                      <EyeIcon />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled
                      aria-label={`Visualização indisponível para ${ATTACHMENT_KINDS[attachment.kind].label}`}
                      title="Word/Excel não podem ser visualizados no navegador. Use Baixar."
                    >
                      <EyeIcon />
                    </Button>
                  )}
                  <a
                    href={attachmentUrls(leadId, attachment.id).download}
                    download={attachment.fileName}
                    className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                    aria-label={`Baixar ${attachment.fileName}`}
                    title="Baixar"
                  >
                    <DownloadIcon />
                  </a>
                  {canEdit && (
                    <ConfirmDialog
                      trigger={
                        <Button type="button" variant="ghost" size="icon-sm" disabled={removing} aria-label={`Remover ${attachment.fileName}`} title="Remover">
                          <Trash2Icon />
                        </Button>
                      }
                      title="Remover anexo?"
                      description={`O arquivo "${attachment.fileName}" será removido deste lead.`}
                      confirmLabel="Remover"
                      onConfirm={() => remove(attachment.id)}
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <AttachmentPreviewDialog leadId={leadId} attachment={previewing} onClose={() => setPreviewing(null)} />
    </div>
  );
}
