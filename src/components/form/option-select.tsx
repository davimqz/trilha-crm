"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type Option = { value: string; label: string };

type OptionSelectProps = {
  id?: string;
  label: string;
  value: string;
  options: readonly Option[];
  onValueChange: (value: string) => void;
  className?: string;
};

// Select do shadcn (Base UI) para listas simples de opções; mostra o rótulo, não o valor
export function OptionSelect({ id, label, value, options, onValueChange, className }: OptionSelectProps) {
  const items = Object.fromEntries(options.map((option) => [option.value, option.label]));
  return (
    <Select
      value={value}
      items={items}
      onValueChange={(next) => {
        if (typeof next === "string") onValueChange(next);
      }}
    >
      <SelectTrigger id={id} aria-label={label} className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
