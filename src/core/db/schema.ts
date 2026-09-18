// Agrega as tabelas do core e de todos os módulos para o Drizzle e o drizzle-kit.
// Use caminhos relativos: o drizzle-kit não resolve o alias "@/".
// Ao criar um módulo com tabelas, adicione: export * from "../../modules/<modulo>/schema";

export * from "../auth/schema";
