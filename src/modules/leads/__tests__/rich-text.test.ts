import { describe, expect, it } from "vitest";

import { richTextDocSchema } from "../rich-text";

const paragraph = (text: string, marks?: unknown[]) => ({
  type: "paragraph",
  content: [{ type: "text", text, ...(marks ? { marks } : {}) }],
});

const doc = (...content: unknown[]) => ({ type: "doc", content });

describe("richTextDocSchema", () => {
  it("aceita negrito, sublinhado, cor da paleta e listas", () => {
    const input = doc(
      paragraph("Reunião", [{ type: "bold" }, { type: "underline" }, { type: "textStyle", attrs: { color: "#dc2626" } }]),
      { type: "bulletList", content: [{ type: "listItem", content: [paragraph("item")] }] },
      { type: "orderedList", attrs: { start: 1 }, content: [{ type: "listItem", content: [paragraph("um")] }] },
    );
    expect(richTextDocSchema.safeParse(input).success).toBe(true);
  });

  it("descarta atributos desconhecidos (ex.: style, onclick)", () => {
    const parsed = richTextDocSchema.parse(
      doc({
        type: "paragraph",
        attrs: { style: "background:url(javascript:alert(1))" },
        content: [{ type: "text", text: "x", onclick: "alert(1)", marks: [{ type: "textStyle", attrs: { color: "#2563eb", fontFamily: "evil" } }] }],
      }),
    );
    expect(JSON.stringify(parsed)).not.toMatch(/style|onclick|javascript|fontFamily/);
  });

  it("troca cor fora da paleta por nula (sem CSS arbitrário)", () => {
    const parsed = richTextDocSchema.parse(
      doc(paragraph("x", [{ type: "textStyle", attrs: { color: "red; background: url(//evil)" } }])),
    );
    expect(JSON.stringify(parsed)).not.toContain("evil");
  });

  it.each([
    ["nó HTML/desconhecido", doc({ type: "html", content: "<script>alert(1)</script>" })],
    ["imagem", doc({ type: "image", attrs: { src: "javascript:alert(1)" } })],
    ["link", doc(paragraph("x", [{ type: "link", attrs: { href: "javascript:alert(1)" } }]))],
    ["documento vazio", doc()],
    ["só espaços", doc(paragraph("   "))],
    ["raiz errada", { type: "paragraph", content: [] }],
    ["texto gigante", doc(paragraph("a".repeat(10_001)))],
  ])("rejeita %s", (_, input) => {
    expect(richTextDocSchema.safeParse(input).success).toBe(false);
  });

  it("rejeita aninhamento excessivo de listas", () => {
    let block: unknown = paragraph("fundo");
    for (let level = 0; level < 10; level++) {
      block = { type: "bulletList", content: [{ type: "listItem", content: [block] }] };
    }
    expect(richTextDocSchema.safeParse(doc(block)).success).toBe(false);
  });
});
