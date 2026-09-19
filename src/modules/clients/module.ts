import { defineModule } from "@/core/modules/types";

// Permissões conforme docs/specs/clients.md §7. Não existe "create": cliente só nasce da conversão de um lead.
// `update` sem "-any" vale só para clientes em que o ator é o responsável (regra no service).
export const clientsModule = defineModule({
  id: "clients",
  name: "Clientes",
  description: "Clientes convertidos, status associativo, atendimentos e linha do tempo",
  permissions: {
    read: { description: "Ver clientes, atendimentos e linha do tempo", roles: ["admin", "manager", "sales", "viewer"] },
    update: { description: "Editar os próprios clientes", roles: ["admin", "manager", "sales"] },
    "update-any": { description: "Editar qualquer cliente", roles: ["admin", "manager"] },
    assign: { description: "Reatribuir o responsável", roles: ["admin", "manager"] },
    "log-service": { description: "Registrar atendimentos", roles: ["admin", "manager", "sales"] },
  },
  navigation: [{ label: "Clientes", href: "/clients", permission: "read", icon: "handshake" }],
});
