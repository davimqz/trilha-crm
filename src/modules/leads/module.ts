import { defineModule } from "@/core/modules/types";

// Permissões conforme docs/specs/leads.md §6. `update`/`archive` sem o sufixo "-any" valem só para
// leads em que o ator é o responsável (regra aplicada no service).
export const leadsModule = defineModule({
  id: "leads",
  name: "Leads",
  description: "Funil de leads em kanban, anotações e anexos",
  permissions: {
    read: { description: "Ver leads, anotações e anexos", roles: ["admin", "manager", "sales", "viewer"] },
    create: { description: "Cadastrar leads", roles: ["admin", "manager", "sales"] },
    update: { description: "Editar, mover, anotar e anexar nos próprios leads", roles: ["admin", "manager", "sales"] },
    "update-any": { description: "Editar, mover, anotar e anexar em qualquer lead", roles: ["admin", "manager"] },
    archive: { description: "Arquivar e desarquivar os próprios leads", roles: ["admin", "manager", "sales"] },
    "archive-any": { description: "Arquivar e desarquivar qualquer lead", roles: ["admin", "manager"] },
    assign: { description: "Reatribuir o responsável", roles: ["admin", "manager"] },
    delete: { description: "Excluir leads", roles: ["admin", "manager"] },
  },
  navigation: [{ label: "Leads", href: "/leads", permission: "read" }],
});
