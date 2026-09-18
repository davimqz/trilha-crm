"use client";

import { Color, TextStyle } from "@tiptap/extension-text-style";
import { EditorContent, useEditor, useEditorState, type Editor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { BoldIcon, ListIcon, ListOrderedIcon, UnderlineIcon } from "lucide-react";
import { useImperativeHandle, type Ref } from "react";

import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";

import { NOTE_COLORS } from "../constants";

export type RichTextEditorHandle = { getJSON: () => JSONContent; clear: () => void; isEmpty: () => boolean };

type RichTextEditorProps = {
  ref?: Ref<RichTextEditorHandle>;
  label: string;
  disabled?: boolean;
};

// Só as extensões permitidas pelo ADR-007 (o servidor valida de novo; isto é só para a UX)
const extensions = [
  StarterKit.configure({
    heading: false,
    blockquote: false,
    code: false,
    codeBlock: false,
    horizontalRule: false,
    italic: false,
    strike: false,
    link: false,
  }),
  TextStyle,
  Color,
];

function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive("bold"),
      underline: current.isActive("underline"),
      bulletList: current.isActive("bulletList"),
      orderedList: current.isActive("orderedList"),
      color: (current.getAttributes("textStyle").color as string | undefined) ?? null,
    }),
  });

  const chain = () => editor.chain().focus();

  function pickColor(value: string | null) {
    if (value) chain().setColor(value).run();
    else chain().unsetColor().run();
  }

  return (
    // preventDefault no mousedown: clicar num botão não tira o foco (nem a seleção) do texto
    <div
      role="toolbar"
      aria-label="Formatação"
      className="flex flex-wrap items-center gap-1 border-b p-1"
      onMouseDown={(event) => event.preventDefault()}
    >
      <Toggle size="sm" aria-label="Negrito" pressed={state.bold} onPressedChange={() => chain().toggleBold().run()}>
        <BoldIcon />
      </Toggle>
      <Toggle size="sm" aria-label="Sublinhado" pressed={state.underline} onPressedChange={() => chain().toggleUnderline().run()}>
        <UnderlineIcon />
      </Toggle>
      <Separator orientation="vertical" className="mx-1 h-5" />
      {/* Paleta fixa direto na barra (sem popover): acessível por teclado e sem disputa de foco com o painel */}
      <div role="group" aria-label="Cor do texto" className="flex items-center gap-1">
        {NOTE_COLORS.map((color) => {
          const active = state.color === color.value;
          return (
            <button
              key={color.label}
              type="button"
              title={`Cor: ${color.label}`}
              aria-label={`Cor do texto: ${color.label}`}
              aria-pressed={active}
              onClick={() => pickColor(color.value)}
              className={cn(
                "flex size-5 items-center justify-center rounded-full border text-[10px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active && "ring-2 ring-ring ring-offset-1",
              )}
              style={{ backgroundColor: color.value ?? "transparent" }}
            >
              {!color.value && "A"}
            </button>
          );
        })}
      </div>
      <Separator orientation="vertical" className="mx-1 h-5" />
      <Toggle size="sm" aria-label="Lista com marcadores" pressed={state.bulletList} onPressedChange={() => chain().toggleBulletList().run()}>
        <ListIcon />
      </Toggle>
      <Toggle size="sm" aria-label="Lista numerada" pressed={state.orderedList} onPressedChange={() => chain().toggleOrderedList().run()}>
        <ListOrderedIcon />
      </Toggle>
    </div>
  );
}

export function RichTextEditor({ ref, label, disabled = false }: RichTextEditorProps) {
  const editor = useEditor({
    extensions,
    editable: !disabled,
    // Evita divergência de hidratação: o editor só monta no client
    immediatelyRender: false,
    editorProps: {
      attributes: {
        "aria-label": label,
        role: "textbox",
        "aria-multiline": "true",
        class:
          "min-h-28 max-h-72 overflow-y-auto px-3 py-2 text-sm focus:outline-none [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_p]:my-1",
      },
    },
  });

  useImperativeHandle(
    ref,
    () => ({
      // Cópia JSON pura: os objetos do Tiptap não são "plain objects" e a Server Action não os serializaria
      getJSON: () => JSON.parse(JSON.stringify(editor?.getJSON() ?? { type: "doc", content: [] })) as JSONContent,
      clear: () => editor?.commands.clearContent(true),
      isEmpty: () => editor?.isEmpty ?? true,
    }),
    [editor],
  );

  return (
    <div className={cn("rounded-lg border bg-background focus-within:ring-3 focus-within:ring-ring/50", disabled && "opacity-60")}>
      {editor ? <Toolbar editor={editor} /> : <div className="h-9 border-b" />}
      <EditorContent editor={editor} />
    </div>
  );
}
