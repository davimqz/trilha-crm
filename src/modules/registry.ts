import type { ModuleManifest } from "@/core/modules/types";

import { leadsModule } from "./leads/module";
import { usersModule } from "./users/module";

// Todo módulo de negócio é registrado aqui (a ordem define o menu). Use a skill `new-module` para criar um.
export const MODULES: readonly ModuleManifest[] = [leadsModule, usersModule];
