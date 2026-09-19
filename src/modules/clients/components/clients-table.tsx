"use client";

import { PencilIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLeadsUrl } from "@/modules/leads/components/use-leads-url";
import { formatPhone } from "@/modules/leads/phone";

import type { ClientRow } from "../service";

import { AssociativeStatusBadge } from "./associative-status-badge";

type ClientsTableProps = { clients: ClientRow[]; filtered: boolean; archived: boolean };

export function ClientsTable({ clients, filtered, archived }: ClientsTableProps) {
  const { push } = useLeadsUrl();
  const open = (clientId: string, tab: string | null = null) => push({ client: clientId, tab });

  if (clients.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {filtered
          ? "Nenhum cliente encontrado para os filtros atuais."
          : archived
            ? "Nenhum cliente arquivado."
            : "Nenhum cliente ainda. Clientes são criados ao arrastar um lead para “Convertido”."}
      </p>
    );
  }

  return (
    <Table data-testid="clients-table">
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>E-mail</TableHead>
          <TableHead>Telefone</TableHead>
          <TableHead>Status Associativo</TableHead>
          <TableHead className="w-12">
            <span className="sr-only">Editar</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {clients.map((client) => (
          // Linha inteira clicável (e acessível por teclado); o lápis abre direto na aba Editar
          <TableRow
            key={client.id}
            data-testid={`client-row-${client.email}`}
            tabIndex={0}
            role="link"
            aria-label={`Abrir cliente ${client.name}`}
            className="cursor-pointer"
            onClick={() => open(client.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter") open(client.id);
            }}
          >
            <TableCell className="font-medium">{client.name}</TableCell>
            <TableCell>{client.email}</TableCell>
            <TableCell className="whitespace-nowrap">{formatPhone(client.phone)}</TableCell>
            <TableCell>
              <AssociativeStatusBadge status={client.associativeStatus} />
            </TableCell>
            <TableCell className="text-right">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Editar ${client.name}`}
                title="Editar"
                onClick={(event) => {
                  event.stopPropagation();
                  open(client.id, "edit");
                }}
                onKeyDown={(event) => event.stopPropagation()}
              >
                <PencilIcon />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
