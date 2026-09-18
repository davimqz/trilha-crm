"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";

import { addNoteAction } from "../actions";
import type { LeadNote } from "../service";

import { RichTextEditor, type RichTextEditorHandle } from "./rich-text-editor";
import { RichTextView } from "./rich-text-view";

type LeadNotesProps = { leadId: string; notes: LeadNote[]; canEdit: boolean };

export function LeadNotes({ leadId, notes, canEdit }: LeadNotesProps) {
  const editorRef = useRef<RichTextEditorHandle>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    const editor = editorRef.current;
    if (!editor || editor.isEmpty()) {
      toast.error("Escreva o conteúdo da anotação.");
      return;
    }
    startTransition(async () => {
      const response = await addNoteAction(leadId, editor.getJSON());
      if (response.status === "success") {
        editor.clear();
        toast.success(response.message);
      } else {
        // Erros de validação do conteúdo vêm em fieldErrors (não há "campos" visíveis no editor)
        toast.error(Object.values(response.fieldErrors ?? {})[0] ?? response.message);
      }
    });
  }

  return (
    <div className="grid gap-6">
      {canEdit ? (
        <div className="grid gap-2">
          <RichTextEditor ref={editorRef} label="Nova anotação" disabled={pending} />
          <Button type="button" onClick={submit} disabled={pending} className="justify-self-start">
            {pending ? "Adicionando…" : "Adicionar anotação"}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Somente o responsável, gestores e administradores podem anotar neste lead.</p>
      )}

      <section aria-labelledby="notes-history" className="grid gap-3">
        <h3 id="notes-history" className="text-sm font-semibold">
          Histórico ({notes.length})
        </h3>
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma anotação ainda.</p>
        ) : (
          <ol className="grid gap-3">
            {notes.map((note) => (
              <li key={note.id} className="rounded-lg border p-3" data-testid="lead-note">
                <article>
                  <header className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                    <h4 className="text-sm font-semibold">{formatDateTime(note.createdAt)}</h4>
                    <span className="text-xs text-muted-foreground">{note.authorName}</span>
                  </header>
                  <RichTextView doc={note.content} />
                </article>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
