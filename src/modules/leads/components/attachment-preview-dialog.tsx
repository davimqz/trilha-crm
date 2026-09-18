"use client";

import { DownloadIcon, ExternalLinkIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

import { ATTACHMENT_KINDS, formatFileSize, previewTypeOf } from "../file-types";
import type { LeadAttachment } from "../service";

// Limite do que é exibido de arquivos de texto (o arquivo inteiro continua disponível em "Baixar")
const TEXT_PREVIEW_MAX_CHARS = 200_000;

export function attachmentUrls(leadId: string, attachmentId: string) {
  const base = `/api/leads/${leadId}/attachments/${attachmentId}`;
  return { download: base, preview: `${base}/preview` };
}

type TextState = { status: "loading" } | { status: "ready"; text: string; truncated: boolean } | { status: "error" };

function TextPreview({ url }: { url: string }) {
  const [state, setState] = useState<TextState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        const text = await response.text();
        if (!cancelled) {
          setState({
            status: "ready",
            text: text.slice(0, TEXT_PREVIEW_MAX_CHARS),
            truncated: text.length > TEXT_PREVIEW_MAX_CHARS,
          });
        }
      })
      .catch(() => !cancelled && setState({ status: "error" }));
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (state.status === "loading") return <Skeleton className="h-[60vh] w-full" />;
  if (state.status === "error") return <p className="text-sm text-destructive">Não foi possível carregar o arquivo.</p>;
  return (
    <div className="grid gap-2">
      {/* Texto renderizado pelo React (escapado): conteúdo com HTML aparece como texto */}
      <pre className="max-h-[65vh] overflow-auto rounded-lg border bg-muted/40 p-3 text-xs whitespace-pre-wrap break-words">
        {state.text}
      </pre>
      {state.truncated && <p className="text-xs text-muted-foreground">Mostrando o início do arquivo. Baixe para ver completo.</p>}
    </div>
  );
}

type AttachmentPreviewDialogProps = {
  leadId: string;
  attachment: LeadAttachment | null;
  onClose: () => void;
};

export function AttachmentPreviewDialog({ leadId, attachment, onClose }: AttachmentPreviewDialogProps) {
  const previewType = attachment ? previewTypeOf(attachment.kind) : null;
  const urls = attachment ? attachmentUrls(leadId, attachment.id) : null;

  return (
    <Dialog open={attachment !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[95vh] flex-col sm:max-w-4xl" data-testid="attachment-preview">
        {attachment && urls && (
          <>
            <DialogHeader className="pr-8">
              <DialogTitle className="truncate">{attachment.fileName}</DialogTitle>
              <DialogDescription>
                {ATTACHMENT_KINDS[attachment.kind].label} · {formatFileSize(attachment.sizeBytes)}
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-auto">
              {previewType === "image" && (
                // eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido pela API autenticada; next/image não se aplica
                <img src={urls.preview} alt={attachment.fileName} className="mx-auto max-h-[70vh] rounded-lg object-contain" />
              )}
              {previewType === "pdf" && (
                <iframe src={urls.preview} title={`Visualização de ${attachment.fileName}`} className="h-[70vh] w-full rounded-lg border" />
              )}
              {previewType === "text" && <TextPreview url={urls.preview} />}
              {!previewType && (
                <p className="text-sm text-muted-foreground">
                  Este tipo de arquivo não pode ser visualizado no navegador. Use Baixar para abrir no computador.
                </p>
              )}
            </div>

            <DialogFooter>
              {previewType && (
                <a href={urls.preview} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline" })}>
                  <ExternalLinkIcon />
                  Abrir em nova aba
                </a>
              )}
              <a href={urls.download} download={attachment.fileName} className={buttonVariants()}>
                <DownloadIcon />
                Baixar
              </a>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
