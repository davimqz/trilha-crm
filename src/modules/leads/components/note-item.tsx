"use client";

import { PencilIcon, Trash2Icon } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";

import { deleteNoteAction, updateNoteAction } from "../actions";
import type { LeadNote } from "../service";

import { RichTextEditor, type RichTextEditorHandle } from "./rich-text-editor";
import { RichTextView } from "./rich-text-view";

// Uma anotação do histórico: título = data/hora; autor, gestor e admin podem editar ou excluir
export function NoteItem({ leadId, note }: { leadId: string; note: LeadNote }) {
  const editorRef = useRef<RichTextEditorHandle>(null);
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    const editor = editorRef.current;
    if (!editor || editor.isEmpty()) {
      toast.error("Escreva o conteúdo da anotação.");
      return;
    }
    startTransition(async () => {
      const response = await updateNoteAction(leadId, note.id, editor.getJSON());
      if (response.status === "success") {
        toast.success(response.message);
        setEditing(false);
      } else {
        toast.error(Object.values(response.fieldErrors ?? {})[0] ?? response.message);
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const response = await deleteNoteAction(leadId, note.id);
      if (response.status === "success") toast.success(response.message);
      else toast.error(response.message);
    });
  }

  return (
    <article className="grid gap-2">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold">{formatDateTime(note.createdAt)}</h4>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">{note.authorName}</span>
          {note.canManage && !editing && (
            <>
              <Button type="button" variant="ghost" size="icon-xs" onClick={() => setEditing(true)} aria-label="Editar anotação" title="Editar" disabled={pending}>
                <PencilIcon />
              </Button>
              <ConfirmDialog
                trigger={
                  <Button type="button" variant="ghost" size="icon-xs" aria-label="Excluir anotação" title="Excluir" disabled={pending}>
                    <Trash2Icon />
                  </Button>
                }
                title="Excluir anotação?"
                description="A anotação será removida. A linha do tempo mantém o registro da exclusão."
                confirmLabel="Excluir"
                onConfirm={remove}
              />
            </>
          )}
        </div>
      </header>

      {editing ? (
        <div className="grid gap-2">
          <RichTextEditor ref={editorRef} label="Editar anotação" initialContent={note.content} disabled={pending} />
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={save} disabled={pending}>
              {pending ? "Salvando…" : "Salvar"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={pending}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <RichTextView doc={note.content} />
      )}

      {note.updatedAt && !editing && (
        <p className="text-xs text-muted-foreground">
          Editada em {formatDateTime(note.updatedAt)}
          {note.updatedByName ? ` por ${note.updatedByName}` : ""}
        </p>
      )}
    </article>
  );
}
