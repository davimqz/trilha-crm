import type { ModuleManifest } from "@/core/modules/types";

import { usersModule } from "./users/module";

// Todo módulo de negócio é registrado aqui. Use a skill `new-module` para criar um.
export const MODULES: readonly ModuleManifest[] = [usersModule];
