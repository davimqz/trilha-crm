// Estado de formulário compartilhado entre Server Actions e componentes client (sem dependências de servidor)
export type ActionResult = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
  // Valores enviados, devolvidos em caso de erro para o formulário não perder o que foi digitado
  values?: Record<string, string>;
};

export const IDLE: ActionResult = { status: "idle" };
