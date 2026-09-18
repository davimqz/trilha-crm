import type { ReactNode } from "react";

import { NOTE_COLOR_VALUES } from "../constants";
import type { RichTextBlock, RichTextDoc, RichTextInline } from "../rich-text";

// Renderizador próprio do JSON das anotações (ADR-007): só conhece os nós permitidos e nunca usa
// dangerouslySetInnerHTML. O texto é escapado pelo React; a cor só é aplicada se for da paleta.

function renderInline(node: RichTextInline, key: number): ReactNode {
  if (node.type === "hardBreak") return <br key={key} />;

  let content: ReactNode = node.text;
  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") content = <strong>{content}</strong>;
    else if (mark.type === "underline") content = <u>{content}</u>;
    else if (mark.type === "textStyle" && mark.attrs?.color && NOTE_COLOR_VALUES.includes(mark.attrs.color)) {
      content = <span style={{ color: mark.attrs.color }}>{content}</span>;
    }
  }
  return <span key={key}>{content}</span>;
}

function renderBlock(block: RichTextBlock, key: number): ReactNode {
  switch (block.type) {
    case "paragraph":
      return <p key={key}>{block.content?.map(renderInline) ?? <br />}</p>;
    case "bulletList":
      return (
        <ul key={key} className="list-disc space-y-1 pl-5">
          {block.content.map((item, index) => (
            <li key={index}>{item.content.map(renderBlock)}</li>
          ))}
        </ul>
      );
    case "orderedList":
      return (
        <ol key={key} start={block.attrs?.start} className="list-decimal space-y-1 pl-5">
          {block.content.map((item, index) => (
            <li key={index}>{item.content.map(renderBlock)}</li>
          ))}
        </ol>
      );
    default:
      return null;
  }
}

export function RichTextView({ doc }: { doc: RichTextDoc }) {
  return <div className="space-y-2 text-sm leading-relaxed break-words">{doc.content.map(renderBlock)}</div>;
}
