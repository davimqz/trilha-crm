import { Alert, AlertDescription } from "@/components/ui/alert";
import type { ActionResult } from "@/core/actions/action-state";

export function FormFeedback({ result }: { result: ActionResult }) {
  if (result.status === "idle" || !result.message) return null;
  return (
    <Alert variant={result.status === "error" ? "destructive" : "default"} role="status">
      <AlertDescription>{result.message}</AlertDescription>
    </Alert>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-xs text-destructive">
      {message}
    </p>
  );
}
