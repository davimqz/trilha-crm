"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { addNoteAction } from "../actions";
import type { LeadNote } from "../service";

import { NoteItem } from "./note-item";
import { RichTextEditor, type RichTextEditorHandle } from "./rich-text-editor";

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
                <NoteItem leadId={leadId} note={note} />
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
