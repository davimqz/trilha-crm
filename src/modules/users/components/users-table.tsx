import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROLE_LABELS } from "@/core/rbac/roles";

import type { UserSummary } from "../service";

import { UserRowActions } from "./user-row-actions";

type UsersTableProps = { users: UserSummary[]; currentUserId: string };

export function UsersTable({ users, currentUserId }: UsersTableProps) {
  if (users.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum usuário cadastrado.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>E-mail</TableHead>
          <TableHead>Papel</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => {
          const isSelf = user.id === currentUserId;
          return (
            <TableRow key={user.id} data-testid={`user-row-${user.email}`}>
              <TableCell className="font-medium">
                {user.name}
                {isSelf && <span className="ml-2 text-xs text-muted-foreground">(você)</span>}
              </TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>{ROLE_LABELS[user.role]}</TableCell>
              <TableCell>
                <Badge variant={user.active ? "secondary" : "destructive"}>{user.active ? "Ativo" : "Desativado"}</Badge>
              </TableCell>
              <TableCell>
                {isSelf ? (
                  <span className="text-xs text-muted-foreground">Use “Alterar minha senha” no menu</span>
                ) : (
                  <UserRowActions userId={user.id} userName={user.name} role={user.role} active={user.active} />
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
