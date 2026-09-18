"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";

import { LEAD_STATUS_LABELS } from "../constants";
import { formatPhone } from "../phone";
import type { LeadCard } from "../service";

import { useLeadsUrl } from "./use-leads-url";

export function ArchivedLeadsTable({ leads, filtered }: { leads: LeadCard[]; filtered: boolean }) {
  const { hrefWith } = useLeadsUrl();

  if (leads.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {filtered ? "Nenhum lead arquivado encontrado para os filtros atuais." : "Nenhum lead arquivado."}
      </p>
    );
  }

  return (
    <Table data-testid="archived-table">
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>E-mail</TableHead>
          <TableHead>Telefone</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Arquivado em</TableHead>
          <TableHead>Arquivado por</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {leads.map((lead) => (
          <TableRow key={lead.id}>
            <TableCell className="font-medium">
              <Link href={hrefWith({ lead: lead.id, tab: null })} scroll={false} className="underline-offset-4 hover:underline">
                {lead.name}
              </Link>
            </TableCell>
            <TableCell>{lead.email}</TableCell>
            <TableCell className="whitespace-nowrap">{formatPhone(lead.phone)}</TableCell>
            <TableCell>
              <Badge variant="secondary">{LEAD_STATUS_LABELS[lead.status]}</Badge>
            </TableCell>
            <TableCell className="whitespace-nowrap">{lead.archivedAt ? formatDateTime(lead.archivedAt) : "—"}</TableCell>
            <TableCell>{lead.archivedByName ?? "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
