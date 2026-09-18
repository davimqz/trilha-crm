"use client";

import { PlusIcon } from "lucide-react";
import { useActionState, useState } from "react";
import { toast } from "sonner";

import { FieldError, FormFeedback } from "@/components/form/form-feedback";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IDLE, type ActionResult } from "@/core/actions/action-state";

import { createLeadAction } from "../actions";
import { LEAD_NAME_MAX, LEAD_STATUS_LABELS, type LeadStatus } from "../constants";

// Montado dentro do diálogo: ao fechar, o estado (erros, campos) é descartado
function CreateLeadForm({ status, onCreated }: { status: LeadStatus; onCreated: () => void }) {
  const [result, formAction, pending] = useActionState(async (previous: ActionResult, formData: FormData) => {
    const response = await createLeadAction(previous, formData);
    if (response.status === "success") {
      toast.success(response.message);
      onCreated();
    }
    return response;
  }, IDLE);
  const errors = result.fieldErrors ?? {};
  const values = result.values ?? {};
  const prefix = `new-lead-${status}`;

  return (
    // key: remonta os campos com os valores devolvidos (inputs do Base UI não aceitam troca de defaultValue)
    <form key={JSON.stringify(values)} action={formAction} className="grid gap-4" noValidate>
      {result.status === "error" && <FormFeedback result={result} />}
      <input type="hidden" name="status" value={status} />
      <div className="grid gap-2">
        <Label htmlFor={`${prefix}-name`}>Nome</Label>
        <Input id={`${prefix}-name`} name="name" defaultValue={values.name} required maxLength={LEAD_NAME_MAX} autoFocus aria-invalid={!!errors.name} aria-describedby={`${prefix}-name-error`} />
        <FieldError id={`${prefix}-name-error`} message={errors.name} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${prefix}-email`}>E-mail</Label>
        <Input id={`${prefix}-email`} name="email" type="email" defaultValue={values.email} required maxLength={254} aria-invalid={!!errors.email} aria-describedby={`${prefix}-email-error`} />
        <FieldError id={`${prefix}-email-error`} message={errors.email} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${prefix}-phone`}>Telefone com DDD</Label>
        <Input
          id={`${prefix}-phone`}
          name="phone"
          defaultValue={values.phone}
          type="tel"
          inputMode="tel"
          placeholder="(11) 91234-5678"
          required
          maxLength={25}
          aria-invalid={!!errors.phone}
          aria-describedby={`${prefix}-phone-error`}
        />
        <FieldError id={`${prefix}-phone-error`} message={errors.phone} />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Cadastrando…" : "Cadastrar"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function CreateLeadDialog({ status }: { status: LeadStatus }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" className="w-full border border-dashed" aria-label={`Adicionar lead em ${LEAD_STATUS_LABELS[status]}`}>
            <PlusIcon />
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo lead — {LEAD_STATUS_LABELS[status]}</DialogTitle>
          <DialogDescription>Todos os campos são obrigatórios.</DialogDescription>
        </DialogHeader>
        {open && <CreateLeadForm status={status} onCreated={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}
