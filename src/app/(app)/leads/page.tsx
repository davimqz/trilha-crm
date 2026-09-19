import type { Metadata } from "next";

import { AccessDenied } from "@/components/access-denied";
import { requireActor } from "@/core/auth/session";
import { NotFoundError } from "@/core/errors";
import { can } from "@/modules/authorization";
import { ArchivedLeadsTable } from "@/modules/leads/components/archived-leads-table";
import { LeadDialog, type SelectedLead } from "@/modules/leads/components/lead-dialog";
import { LeadsBoard } from "@/modules/leads/components/leads-board";
import { LeadsToolbar } from "@/modules/leads/components/leads-toolbar";
import { LEAD_TABS, type LeadTab } from "@/modules/leads/constants";
import { getLeadsService } from "@/modules/leads/service";
import { buildTimeline } from "@/modules/leads/timeline";
import { listLeadsSchema } from "@/modules/leads/validators";

export const metadata: Metadata = { title: "Leads · Trilha CRM" };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function LeadsPage({ searchParams }: PageProps<"/leads">) {
  const actor = await requireActor();
  if (!can(actor, "leads:read")) return <AccessDenied />;

  const params = await searchParams;
  // Parâmetros da URL são entrada do usuário: valores inválidos caem no padrão
  const query = listLeadsSchema.parse({
    q: first(params.q),
    owner: first(params.owner),
    period: first(params.period),
    sort: first(params.sort),
    archived: first(params.view) === "archived",
  });
  const requestedTab = first(params.tab);
  const tab: LeadTab = LEAD_TABS.includes(requestedTab as LeadTab) ? (requestedTab as LeadTab) : "info";

  const service = getLeadsService();
  const [leads, users] = await Promise.all([service.listLeads(actor, query), service.listAssignableUsers(actor)]);

  let selected: SelectedLead | null = null;
  const leadId = first(params.lead);
  if (leadId) {
    try {
      const [lead, notes, attachments, events] = await Promise.all([
        service.getLead(actor, { leadId }),
        service.listNotes(actor, { leadId }),
        service.listAttachments(actor, { leadId }),
        service.listEvents(actor, { leadId }),
      ]);
      selected = { lead, notes, attachments, timeline: buildTimeline({ events, notes, attachments }) };
    } catch (error) {
      // Lead inexistente/excluído ou id inválido na URL: só não abre o painel
      if (!(error instanceof NotFoundError) && !(error instanceof Error && error.name === "ZodError")) throw error;
    }
  }

  const filtered = query.q !== "" || query.owner !== "all" || query.period !== "any";

  return (
    <section className="grid gap-4">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold">Leads</h1>
        <p className="text-sm text-muted-foreground">
          {query.archived ? "Leads arquivados manualmente." : "Arraste os cards entre as colunas para atualizar o estágio."}
        </p>
      </div>

      <LeadsToolbar key={String(query.archived)} query={query} users={users} />

      {query.archived ? (
        <ArchivedLeadsTable leads={leads} filtered={filtered} />
      ) : (
        <LeadsBoard leads={leads} canCreate={can(actor, "leads:create")} filtered={filtered} />
      )}

      <LeadDialog selected={selected} tab={tab} users={users} />
    </section>
  );
}
