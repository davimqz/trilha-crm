import { describe, expect, it } from "vitest";

import { detectAttachmentKind, formatFileSize, sanitizeFileName } from "../file-types";

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (text: string) => new TextEncoder().encode(text);
const concat = (...parts: Uint8Array[]) => {
  const result = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
};

const PDF = ascii("%PDF-1.7\n...");
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0);
const JPG = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0);
const OLE2 = bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0);
const DOCX = concat(bytes(0x50, 0x4b, 0x03, 0x04), ascii("....word/document.xml...."));
const XLSX = concat(bytes(0x50, 0x4b, 0x03, 0x04), ascii("....xl/workbook.xml...."));

describe("detectAttachmentKind", () => {
  it.each([
    ["proposta.pdf", PDF, "pdf"],
    ["foto.PNG", PNG, "png"],
    ["foto.jpeg", JPG, "jpg"],
    ["contrato.doc", OLE2, "doc"],
    ["planilha.xls", OLE2, "xls"],
    ["contrato.docx", DOCX, "docx"],
    ["planilha.xlsx", XLSX, "xlsx"],
    ["notas.txt", ascii("olá, mundo"), "txt"],
    ["base.csv", ascii("nome;email\nAna;a@b.co"), "csv"],
  ])("reconhece %s", (name, data, expected) => {
    expect(detectAttachmentKind(name, data)).toBe(expected);
  });

  it.each([
    ["HTML disfarçado de PDF", "proposta.pdf", ascii("<html><script>alert(1)</script>")],
    ["executável renomeado", "foto.png", bytes(0x4d, 0x5a, 0x90, 0x00)],
    ["SVG (não permitido)", "logo.svg", ascii("<svg onload=alert(1)>")],
    ["HTML", "pagina.html", ascii("<html></html>")],
    ["sem extensão", "arquivo", PDF],
    ["dupla extensão", "nota.pdf.exe", PDF],
    ["zip qualquer como docx", "contrato.docx", concat(bytes(0x50, 0x4b, 0x03, 0x04), ascii("payload"))],
    ["binário como txt", "dados.txt", bytes(0x00, 0x01, 0x02)],
    ["UTF-8 inválido como csv", "base.csv", bytes(0xc3, 0x28)],
  ])("recusa %s", (_, name, data) => {
    expect(detectAttachmentKind(name, data)).toBeNull();
  });
});

describe("sanitizeFileName", () => {
  it.each([
    ["../../etc/passwd", "passwd"],
    ["C:\\Users\\x\\proposta.pdf", "proposta.pdf"],
    ["..hidden.pdf", "hidden.pdf"],
    ['a<b>:"c|?*.pdf', "abc.pdf"],
    ["nome\u0000com\u001fcontrole.pdf", "nomecomcontrole.pdf"],
    ["   ", "arquivo"],
  ])("%s → %s", (input, expected) => {
    expect(sanitizeFileName(input)).toBe(expected);
  });

  it("limita o tamanho mantendo a extensão", () => {
    const result = sanitizeFileName(`${"a".repeat(300)}.pdf`);
    expect(result.length).toBeLessThanOrEqual(200);
    expect(result.endsWith(".pdf")).toBe(true);
  });
});

describe("formatFileSize", () => {
  it("formata em B, KB e MB", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(1536)).toBe("1,5 KB");
    expect(formatFileSize(10 * 1024 * 1024)).toBe("10,0 MB");
  });
});
