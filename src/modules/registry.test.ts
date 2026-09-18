import { describe, expect, it } from "vitest";

import { validateModules } from "@/core/modules/validate-modules";

import { MODULES } from "./registry";

describe("registry de módulos", () => {
  it("contém apenas manifestos válidos", () => {
    expect(validateModules(MODULES)).toEqual([]);
  });
});
