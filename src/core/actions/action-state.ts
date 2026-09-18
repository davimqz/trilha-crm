// Estado de formulário compartilhado entre Server Actions e componentes client (sem dependências de servidor)
export type ActionResult = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

export const IDLE: ActionResult = { status: "idle" };
