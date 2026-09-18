import { z } from "zod";

import { NOTE_COLOR_VALUES, NOTE_TEXT_MAX } from "./constants";

// Schema estrito do JSON do Tiptap/ProseMirror (ADR-007). Só os nós e marcas abaixo existem;
// `z.object` descarta atributos desconhecidos, então o que é salvo é sempre a saída do parse.

const MAX_DEPTH = 8;
const MAX_NODES = 3000;

const colorSchema = z.enum(NOTE_COLOR_VALUES as [string, ...string[]]).nullable().catch(null);

const markSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("bold") }),
  z.object({ type: z.literal("underline") }),
  z.object({ type: z.literal("textStyle"), attrs: z.object({ color: colorSchema.optional() }).optional() }),
]);

const textSchema = z.object({
  type: z.literal("text"),
  text: z.string().min(1).max(NOTE_TEXT_MAX),
  marks: z.array(markSchema).max(3).optional(),
});

const hardBreakSchema = z.object({ type: z.literal("hardBreak") });

const inlineSchema = z.discriminatedUnion("type", [textSchema, hardBreakSchema]);

const paragraphSchema = z.object({
  type: z.literal("paragraph"),
  content: z.array(inlineSchema).max(500).optional(),
});

export type RichTextInline = z.infer<typeof inlineSchema>;
export type RichTextMark = z.infer<typeof markSchema>;

export type RichTextBlock =
  | z.infer<typeof paragraphSchema>
  | { type: "bulletList"; content: RichTextListItem[] }
  | { type: "orderedList"; attrs?: { start?: number }; content: RichTextListItem[] };

export type RichTextListItem = { type: "listItem"; content: RichTextBlock[] };

const listItemSchema: z.ZodType<RichTextListItem> = z.lazy(() =>
  z.object({ type: z.literal("listItem"), content: z.array(blockSchema).min(1).max(50) }),
);

const blockSchema: z.ZodType<RichTextBlock> = z.lazy(() =>
  z.discriminatedUnion("type", [
    paragraphSchema,
    z.object({ type: z.literal("bulletList"), content: z.array(listItemSchema).min(1).max(200) }),
    z.object({
      type: z.literal("orderedList"),
      attrs: z.object({ start: z.number().int().min(1).max(10_000).optional() }).optional(),
      content: z.array(listItemSchema).min(1).max(200),
    }),
  ]),
);

export type RichTextDoc = { type: "doc"; content: RichTextBlock[] };

type Stats = { depth: number; nodes: number; textLength: number };

function measure(blocks: readonly RichTextBlock[], depth: number, stats: Stats) {
  stats.depth = Math.max(stats.depth, depth);
  for (const block of blocks) {
    stats.nodes++;
    if (block.type === "paragraph") {
      for (const inline of block.content ?? []) {
        stats.nodes++;
        if (inline.type === "text") stats.textLength += inline.text.length;
      }
    } else {
      for (const item of block.content) {
        stats.nodes++;
        measure(item.content, depth + 1, stats);
      }
    }
  }
}

export const richTextDocSchema: z.ZodType<RichTextDoc> = z
  .object({ type: z.literal("doc"), content: z.array(blockSchema).min(1).max(500) })
  .superRefine((doc, context) => {
    const stats: Stats = { depth: 0, nodes: 0, textLength: 0 };
    measure(doc.content, 1, stats);
    if (stats.depth > MAX_DEPTH) context.addIssue({ code: "custom", message: "Listas aninhadas demais." });
    if (stats.nodes > MAX_NODES) context.addIssue({ code: "custom", message: "Anotação muito longa." });
    if (stats.textLength > NOTE_TEXT_MAX) {
      context.addIssue({ code: "custom", message: `A anotação pode ter até ${NOTE_TEXT_MAX} caracteres.` });
    }
    if (stats.textLength === 0 || /^\s*$/.test(plainText(doc))) {
      context.addIssue({ code: "custom", message: "Escreva o conteúdo da anotação." });
    }
  });

export function plainText(doc: RichTextDoc): string {
  const parts: string[] = [];
  const walk = (blocks: readonly RichTextBlock[]) => {
    for (const block of blocks) {
      if (block.type === "paragraph") {
        for (const inline of block.content ?? []) parts.push(inline.type === "text" ? inline.text : "\n");
        parts.push("\n");
      } else {
        for (const item of block.content) walk(item.content);
      }
    }
  };
  walk(doc.content);
  return parts.join("");
}
