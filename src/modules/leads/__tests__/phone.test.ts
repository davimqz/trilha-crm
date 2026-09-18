import { describe, expect, it } from "vitest";

import { formatPhone, normalizePhone } from "../phone";

describe("normalizePhone", () => {
  it.each([
    ["(11) 91234-5678", "11912345678"],
    ["11912345678", "11912345678"],
    ["+55 (81) 99876-5432", "81998765432"],
    ["55 21 98765 4321", "21987654321"],
    ["011 91234-5678", "11912345678"],
    ["(11) 3123-4567", "1131234567"],
    ["61 2345.6789", "6123456789"],
  ])("aceita %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each([
    ["sem DDD", "91234-5678"],
    ["DDD inexistente (10)", "(10) 91234-5678"],
    ["DDD inexistente (20)", "(20) 91234-5678"],
    ["celular sem 9 na frente", "(11) 81234-5678"],
    ["fixo começando com 9 (8 dígitos)", "(11) 9123-4567"],
    ["dígitos a mais", "(11) 912345-67890"],
    ["país diferente", "+1 212 555 0100"],
    ["letras", "(11) 9abcd-5678"],
    ["vazio", ""],
    ["script", "<script>11912345678"],
  ])("rejeita %s", (_, input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});

describe("formatPhone", () => {
  it("formata celular e fixo", () => {
    expect(formatPhone("11912345678")).toBe("(11) 91234-5678");
    expect(formatPhone("1131234567")).toBe("(11) 3123-4567");
  });
});
