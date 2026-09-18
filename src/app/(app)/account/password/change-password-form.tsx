"use client";

import { useRef, useState, type FormEvent } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, authErrorMessage } from "@/core/auth/client";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/core/auth/password-policy";

type Feedback = { kind: "success" | "error"; message: string } | null;

export function ChangePasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const currentPassword = String(formData.get("currentPassword") ?? "");
    const newPassword = String(formData.get("newPassword") ?? "");

    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      setFeedback({ kind: "error", message: `A nova senha deve ter ao menos ${PASSWORD_MIN_LENGTH} caracteres.` });
      return;
    }
    if (newPassword !== formData.get("confirmPassword")) {
      setFeedback({ kind: "error", message: "A confirmação não confere com a nova senha." });
      return;
    }

    setPending(true);
    const { error } = await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true });
    setPending(false);

    if (error) {
      setFeedback({ kind: "error", message: authErrorMessage(error.status, "Senha atual incorreta.") });
      return;
    }
    formRef.current?.reset();
    setFeedback({ kind: "success", message: "Senha alterada. As outras sessões foram encerradas." });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="grid max-w-sm gap-4" noValidate>
      {feedback && (
        <Alert variant={feedback.kind === "error" ? "destructive" : "default"} role="status">
          <AlertDescription>{feedback.message}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-2">
        <Label htmlFor="currentPassword">Senha atual</Label>
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required maxLength={PASSWORD_MAX_LENGTH} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="newPassword">Nova senha</Label>
        <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} aria-describedby="newPassword-hint" />
        <p id="newPassword-hint" className="text-xs text-muted-foreground">
          Mínimo de {PASSWORD_MIN_LENGTH} caracteres.
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required maxLength={PASSWORD_MAX_LENGTH} />
      </div>
      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? "Salvando…" : "Alterar senha"}
      </Button>
    </form>
  );
}
