import { describe, expect, it } from "vitest";

import { serviceRecordsToTimeline } from "@/modules/clients/timeline";

import { contactChangeEvents } from "../events";
import { buildTimeline, describeEvent, excerpt } from "../timeline";

const at = (iso: string) => new Date(iso);

describe("describeEvent", () => {
  it.each([
    [{ type: "created", fromValue: null, toValue: "prospect" }, { title: "Lead criado" }],
    [{ type: "converted", fromValue: null, toValue: null }, { title: "Convertido em cliente" }],
    [{ type: "conversion_reverted", fromValue: null, toValue: null }, { title: "Conversão desfeita" }],
    [{ type: "name_updated", fromValue: null, toValue: null }, { title: "Atualização de nome" }],
    [{ type: "email_updated", fromValue: null, toValue: null }, { title: "Atualização de e-mail" }],
    [{ type: "phone_updated", fromValue: null, toValue: null }, { title: "Atualização de telefone" }],
    [{ type: "birth_date_updated", fromValue: null, toValue: null }, { title: "Atualização de data de nascimento" }],
    [{ type: "contact_updated", fromValue: null, toValue: null }, { title: "Atualização de contato" }],
    // Trecho do texto apagado fica gravado, mas não aparece
    [{ type: "note_deleted", fromValue: "texto antigo", toValue: null }, { title: "Anotação excluída" }],
    [{ type: "service_record_edited", fromValue: null, toValue: "Assunto" }, { title: "Atendimento editado" }],
    [
      { type: "status_changed", fromValue: "first_contact", toValue: "meeting_scheduled" },
      { change: { from: "Primeiro Contato", to: "Reunião Agendada" } },
    ],
    [{ type: "owner_changed", fromValue: "Ana", toValue: "Bruno" }, { title: "Responsável", change: { from: "Ana", to: "Bruno" } }],
    [
      { type: "associative_status_changed", fromValue: "Adimplente", toValue: "Inadimplente" },
      { title: "Status associativo", change: { from: "Adimplente", to: "Inadimplente" } },
    ],
  ] as const)("%o", (event, expected) => {
    expect(describeEvent(event)).toEqual(expected);
  });
});

describe("buildTimeline", () => {
  it("junta eventos, anotações, anexos e atendimentos do mais recente ao mais antigo, só com rótulos curtos", () => {
    const items = buildTimeline({
      events: [
        { id: "e1", type: "created", fromValue: null, toValue: "prospect", createdAt: at("2026-09-01T10:00:00Z") },
        { id: "e2", type: "converted", fromValue: null, toValue: null, createdAt: at("2026-09-10T10:00:00Z") },
      ],
      notes: [{ id: "n1", createdAt: at("2026-09-05T10:00:00Z") }],
      attachments: [{ id: "a1", createdAt: at("2026-09-06T10:00:00Z") }],
      extra: serviceRecordsToTimeline([{ id: "s1", occurredAt: at("2026-09-12T15:00:00Z") }]),
    });

    expect(items.map((item) => [item.kind, item.title])).toEqual([
      ["service", "Atendimento registrado"],
      ["event", "Convertido em cliente"],
      ["attachment", "Anexo adicionado"],
      ["note", "Anotação adicionada"],
      ["event", "Lead criado"],
    ]);
  });

  it("ordem estável quando dois itens têm o mesmo horário", () => {
    const same = at("2026-09-01T10:00:00Z");
    const items = buildTimeline({
      events: [
        { id: "b", type: "archived", fromValue: null, toValue: null, createdAt: same },
        { id: "a", type: "unarchived", fromValue: null, toValue: null, createdAt: same },
      ],
    });
    expect(items.map((item) => item.id)).toEqual(["event-a", "event-b"]);
  });
});

describe("contactChangeEvents", () => {
  const before = { name: "Ana", email: "ana@x.com", phone: "11912345678", birthDate: null };

  it("gera um evento por campo alterado, sem gravar os valores", () => {
    const events = contactChangeEvents("lead-1", "user-1", before, {
      ...before,
      email: "ana@y.com",
      birthDate: "1990-05-20",
    });
    expect(events).toEqual([
      { leadId: "lead-1", type: "email_updated", actorId: "user-1" },
      { leadId: "lead-1", type: "birth_date_updated", actorId: "user-1" },
    ]);
  });

  it("nenhum evento quando nada mudou", () => {
    expect(contactChangeEvents("lead-1", "user-1", before, { ...before })).toEqual([]);
  });
});

describe("excerpt", () => {
  it("compacta espaços e corta textos longos", () => {
    expect(excerpt("  a \n\n b  ")).toBe("a b");
    expect(excerpt("x".repeat(300))).toHaveLength(160);
  });
});
