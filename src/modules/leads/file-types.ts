// Tipos de anexo permitidos (ADR-006). O tipo é confirmado pelo CONTEÚDO do arquivo; a extensão só
// desambigua formatos que compartilham assinatura (ex.: DOC e XLS são ambos OLE2).

export const ATTACHMENT_KINDS = {
  pdf: { label: "PDF", mimeType: "application/pdf", extensions: ["pdf"] },
  doc: { label: "DOC", mimeType: "application/msword", extensions: ["doc"] },
  docx: {
    label: "DOCX",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extensions: ["docx"],
  },
  xls: { label: "XLS", mimeType: "application/vnd.ms-excel", extensions: ["xls"] },
  xlsx: {
    label: "XLSX",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extensions: ["xlsx"],
  },
  png: { label: "PNG", mimeType: "image/png", extensions: ["png"] },
  jpg: { label: "JPG", mimeType: "image/jpeg", extensions: ["jpg", "jpeg"] },
  txt: { label: "TXT", mimeType: "text/plain; charset=utf-8", extensions: ["txt"] },
  csv: { label: "CSV", mimeType: "text/csv; charset=utf-8", extensions: ["csv"] },
} as const;

export type AttachmentKind = keyof typeof ATTACHMENT_KINDS;

// Tipos que o navegador exibe nativamente. DOC/DOCX/XLS/XLSX não: exigiriam enviar o arquivo a um serviço
// externo (Office/Google), o que exporia dados dos leads. Texto é sempre exibido como text/plain (nunca HTML).
export const PREVIEWABLE_KINDS: Partial<Record<AttachmentKind, "pdf" | "image" | "text">> = {
  pdf: "pdf",
  png: "image",
  jpg: "image",
  txt: "text",
  csv: "text",
};

export function previewTypeOf(kind: AttachmentKind) {
  return PREVIEWABLE_KINDS[kind] ?? null;
}

export const ACCEPTED_EXTENSIONS = Object.values(ATTACHMENT_KINDS).flatMap((kind) =>
  kind.extensions.map((extension) => `.${extension}`),
);

const startsWith = (data: Uint8Array, signature: number[]) =>
  data.length >= signature.length && signature.every((byte, index) => data[index] === byte);

const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPG = [0xff, 0xd8, 0xff];
const OLE2 = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const ZIP = [0x50, 0x4b, 0x03, 0x04];

// Sem Buffer: este arquivo também é usado no client (rótulos, tamanho)
function containsAscii(data: Uint8Array, text: string): boolean {
  const needle = Array.from(text, (char) => char.charCodeAt(0));
  outer: for (let start = 0; start <= data.length - needle.length; start++) {
    for (let offset = 0; offset < needle.length; offset++) {
      if (data[start + offset] !== needle[offset]) continue outer;
    }
    return true;
  }
  return false;
}

function isPlainUtf8Text(data: Uint8Array): boolean {
  if (data.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(data);
    return true;
  } catch {
    return false;
  }
}

const CONTENT_CHECKS: Record<AttachmentKind, (data: Uint8Array) => boolean> = {
  pdf: (data) => startsWith(data, PDF),
  png: (data) => startsWith(data, PNG),
  jpg: (data) => startsWith(data, JPG),
  doc: (data) => startsWith(data, OLE2),
  xls: (data) => startsWith(data, OLE2),
  docx: (data) => startsWith(data, ZIP) && containsAscii(data, "word/"),
  xlsx: (data) => startsWith(data, ZIP) && containsAscii(data, "xl/"),
  txt: isPlainUtf8Text,
  csv: isPlainUtf8Text,
};

export function extensionOf(fileName: string): string {
  const match = /\.([a-z0-9]{1,8})$/i.exec(fileName);
  return match ? match[1].toLowerCase() : "";
}

export function detectAttachmentKind(fileName: string, data: Uint8Array): AttachmentKind | null {
  const extension = extensionOf(fileName);
  const kind = (Object.keys(ATTACHMENT_KINDS) as AttachmentKind[]).find((candidate) =>
    (ATTACHMENT_KINDS[candidate].extensions as readonly string[]).includes(extension),
  );
  if (!kind) return null;
  return CONTENT_CHECKS[kind](data) ? kind : null;
}

// Remove caminhos e caracteres de controle; mantém a extensão
export function sanitizeFileName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[\x00-\x1f\x7f<>:"|?*]/g, "").replace(/\s+/g, " ").trim();
  const withoutDots = cleaned.replace(/^\.+/, "");
  if (!withoutDots) return "arquivo";
  if (withoutDots.length <= 200) return withoutDots;
  const extension = extensionOf(withoutDots);
  return `${withoutDots.slice(0, 190)}${extension ? `.${extension}` : ""}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace(".", ",")} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
