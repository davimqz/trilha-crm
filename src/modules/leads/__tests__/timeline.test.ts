import { describe, expect, it } from "vitest";

import { serviceRecordsToTimeline } from "@/modules/clients/timeline";

import { buildTimeline, eventTitle, excerpt } from "../timeline";

const at = (iso: string) => new Date(iso);
const doc = (text: string) => ({ type: "doc" as const, content: [{ type: "paragraph" as const, content: [{ type: "text" as const, text }] }] });

describe("eventTitle", () => {
  it.each([
    [{ type: "created", fromValue: null, toValue: "prospect" }, "Virou lead em Prospect"],
    [{ type: "created", fromValue: null, toValue: null }, "Virou lead"],
    [{ type: "status_changed", fromValue: "first_contact", toValue: "meeting_scheduled" }, "Movido de Primeiro Contato para Reunião Agendada"],
    [{ type: "converted", fromValue: null, toValue: null }, "Convertido em cliente"],
    [{ type: "conversion_reverted", fromValue: null, toValue: null }, "Conversão desfeita — cliente arquivado"],
    [{ type: "client_reactivated", fromValue: null, toValue: null }, "Cliente reativado"],
    [{ type: "owner_changed", fromValue: "Ana", toValue: "Bruno" }, "Responsável alterado de Ana para Bruno"],
    [{ type: "associative_status_changed", fromValue: "Adimplente", toValue: "Inadimplente" }, "Status associativo: Adimplente → Inadimplente"],
  ] as const)("%o → %s", (event, expected) => {
    expect(eventTitle(event)).toBe(expected);
  });
});

describe("buildTimeline", () => {
  it("junta eventos, anotações, anexos e atendimentos do mais recente ao mais antigo", () => {
    const items = buildTimeline({
      events: [
        { id: "e1", type: "created", fromValue: null, toValue: "prospect", actorName: "Ana", createdAt: at("2026-09-01T10:00:00Z") },
        { id: "e2", type: "converted", fromValue: null, toValue: null, actorName: "Ana", createdAt: at("2026-09-10T10:00:00Z") },
      ],
      notes: [{ id: "n1", content: doc("Cliente pediu proposta"), authorName: "Bruno", createdAt: at("2026-09-05T10:00:00Z") }],
      attachments: [{ id: "a1", fileName: "proposta.pdf", uploadedByName: "Bruno", createdAt: at("2026-09-06T10:00:00Z") }],
      extra: serviceRecordsToTimeline([
        {
          id: "s1",
          occurredAt: at("2026-09-12T15:00:00Z"),
          type: "meeting",
          subject: "Onboarding",
          description: doc("Apresentação da plataforma"),
          responsibleName: "Carla",
        },
      ]),
    });

    expect(items.map((item) => item.title)).toEqual([
      "Atendimento (Reunião): Onboarding",
      "Convertido em cliente",
      "Anexo adicionado: proposta.pdf",
      "Anotação adicionada",
      "Virou lead em Prospect",
    ]);
    expect(items[0]).toMatchObject({ kind: "service", actor: "Carla", description: "Apresentação da plataforma" });
    expect(items[3]).toMatchObject({ kind: "note", description: "Cliente pediu proposta" });
  });

  it("ordem estável quando dois itens têm o mesmo horário", () => {
    const same = at("2026-09-01T10:00:00Z");
    const items = buildTimeline({
      events: [
        { id: "b", type: "archived", fromValue: null, toValue: null, actorName: "X", createdAt: same },
        { id: "a", type: "unarchived", fromValue: null, toValue: null, actorName: "X", createdAt: same },
      ],
    });
    expect(items.map((item) => item.id)).toEqual(["event-a", "event-b"]);
  });
});

describe("excerpt", () => {
  it("compacta espaços e corta textos longos", () => {
    expect(excerpt("  a \n\n b  ")).toBe("a b");
    expect(excerpt("x".repeat(300))).toHaveLength(160);
  });
});
