import { createAuthorization } from "@/core/rbac/authorization";

import { MODULES } from "./registry";

// Ponto único de autorização usado por pages, actions e services dos módulos
export const { can, requirePermission } = createAuthorization(MODULES);
