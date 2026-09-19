import type { Metadata } from "next";

import { AccessDenied } from "@/components/access-denied";
import { requireActor } from "@/core/auth/session";
import { NotFoundError } from "@/core/errors";
import { can } from "@/modules/authorization";
import { ClientDialog, type SelectedClient } from "@/modules/clients/components/client-dialog";
import { ClientsTable } from "@/modules/clients/components/clients-table";
import { ClientsToolbar } from "@/modules/clients/components/clients-toolbar";
import { CLIENT_TABS, type ClientTab } from "@/modules/clients/constants";
import { getClientsService } from "@/modules/clients/service";
import { serviceRecordsToTimeline } from "@/modules/clients/timeline";
import { listClientsSchema } from "@/modules/clients/validators";
import { getLeadsService } from "@/modules/leads/service";
import { buildTimeline } from "@/modules/leads/timeline";

export const metadata: Metadata = { title: "Clientes · Trilha CRM" };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

// "Agora" no fuso de São Paulo, no formato do <input type="datetime-local">
function nowLocalSaoPaulo(): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export default async function ClientsPage({ searchParams }: PageProps<"/clients">) {
  const actor = await requireActor();
  if (!can(actor, "clients:read")) return <AccessDenied />;

  const params = await searchParams;
  const query = listClientsSchema.parse({
    q: first(params.q),
    owner: first(params.owner),
    status: first(params.status),
    sort: first(params.sort),
    archived: first(params.view) === "archived",
  });
  const requestedTab = first(params.tab);
  const tab: ClientTab = CLIENT_TABS.includes(requestedTab as ClientTab) ? (requestedTab as ClientTab) : "info";

  const clientsService = getClientsService();
  const leadsService = getLeadsService();
  const [rows, activeCount, users] = await Promise.all([
    clientsService.listClients(actor, query),
    clientsService.countActive(actor),
    leadsService.listAssignableUsers(actor),
  ]);

  let selected: SelectedClient | null = null;
  const clientId = first(params.client);
  if (clientId) {
    try {
      const client = await clientsService.getClient(actor, { clientId });
      const leadId = client.leadId;
      const [lead, notes, attachments, events, services] = await Promise.all([
        leadsService.getLead(actor, { leadId }),
        leadsService.listNotes(actor, { leadId }),
        leadsService.listAttachments(actor, { leadId }),
        leadsService.listEvents(actor, { leadId }),
        clientsService.listServiceRecords(actor, { clientId }),
      ]);
      selected = {
        client,
        leadCanEdit: lead.canEdit,
        notes,
        attachments,
        services,
        timeline: buildTimeline({ events, notes, attachments, extra: serviceRecordsToTimeline(services) }),
      };
    } catch (error) {
      // Cliente inexistente ou id inválido na URL: só não abre o modal
      if (!(error instanceof NotFoundError) && !(error instanceof Error && error.name === "ZodError")) throw error;
    }
  }

  const filtered = query.q !== "" || query.owner !== "all" || query.status !== "all";

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold">Clientes</h1>
          <p className="text-sm text-muted-foreground">Clientes nascem da conversão de leads no kanban.</p>
        </div>
        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm" data-testid="active-clients">
          Clientes Ativos: <strong className="text-base">{activeCount}</strong>
        </p>
      </div>

      <ClientsToolbar key={String(query.archived)} query={query} users={users} />
      <ClientsTable clients={rows} filtered={filtered} archived={query.archived} />

      <ClientDialog selected={selected} tab={tab} users={users} currentUserId={actor.userId} nowLocal={nowLocalSaoPaulo()} />
    </section>
  );
}
