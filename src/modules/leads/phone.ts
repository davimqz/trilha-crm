// Telefones brasileiros: guardados só com dígitos (DDD + número), exibidos como (11) 91234-5678

// DDDs em uso segundo o plano de numeração da Anatel
const VALID_DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48,
  49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

const ALLOWED_INPUT = /^[\d\s().+-]{8,25}$/;

export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (!ALLOWED_INPUT.test(trimmed)) return null;

  let digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) {
    if (!digits.startsWith("55")) return null;
    digits = digits.slice(2);
  } else if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    digits = digits.slice(2);
  } else if ((digits.length === 11 || digits.length === 12) && digits.startsWith("0")) {
    // Prefixo de discagem interurbana (0 + DDD)
    digits = digits.slice(1);
  }

  if (digits.length !== 10 && digits.length !== 11) return null;
  if (!VALID_DDDS.has(Number(digits.slice(0, 2)))) return null;

  const number = digits.slice(2);
  if (number.length === 9 && !number.startsWith("9")) return null; // celular
  if (number.length === 8 && !/^[2-5]/.test(number)) return null; // fixo

  return digits;
}

export function formatPhone(digits: string): string {
  if (!/^\d{10,11}$/.test(digits)) return digits;
  const ddd = digits.slice(0, 2);
  const number = digits.slice(2);
  const split = number.length - 4;
  return `(${ddd}) ${number.slice(0, split)}-${number.slice(split)}`;
}
