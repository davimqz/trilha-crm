import { defineModule } from "@/core/modules/types";

export const usersModule = defineModule({
  id: "users",
  name: "Usuários",
  description: "Gestão de usuários, papéis e acesso ao CRM",
  permissions: {
    read: { description: "Ver usuários", roles: ["admin"] },
    manage: { description: "Criar usuários, alterar papéis, desativar e redefinir senhas", roles: ["admin"] },
  },
  navigation: [{ label: "Usuários", href: "/settings/users", permission: "read" }],
});
