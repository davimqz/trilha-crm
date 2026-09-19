"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LeadAttachments } from "@/modules/leads/components/lead-attachments";
import { LeadNotes } from "@/modules/leads/components/lead-notes";
import { TimelineView } from "@/modules/leads/components/timeline-view";
import { useLeadsUrl } from "@/modules/leads/components/use-leads-url";
import type { AssignableUser, LeadAttachment, LeadNote } from "@/modules/leads/service";
import type { TimelineItem } from "@/modules/leads/timeline";

import { ASSOCIATIVE_STATUS_LABELS, type ClientTab } from "../constants";
import type { ClientDetail, ServiceRecord } from "../service";

import { ClientEditForm } from "./client-edit-form";
import { ClientInfo } from "./client-info";
import { ServiceRecords } from "./service-records";

export type SelectedClient = {
  client: ClientDetail;
  // Anotações e anexos são do lead (histórico compartilhado, ADR-008); a posse segue as regras do lead
  leadCanEdit: boolean;
  notes: LeadNote[];
  attachments: LeadAttachment[];
  services: ServiceRecord[];
  timeline: TimelineItem[];
};

type ClientDialogProps = {
  selected: SelectedClient | null;
  tab: ClientTab;
  users: AssignableUser[];
  currentUserId: string;
  nowLocal: string;
};

export function ClientDialog({ selected, tab, users, currentUserId, nowLocal }: ClientDialogProps) {
  const { push, replace } = useLeadsUrl();
  const close = () => push({ client: null, tab: null });

  return (
    <Dialog open={selected !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-3xl" data-testid="client-dialog">
        {selected && (
          <>
            <DialogHeader className="border-b p-4 pr-12">
              <DialogTitle className="text-lg">{selected.client.name}</DialogTitle>
              <DialogDescription>
                Cliente · {ASSOCIATIVE_STATUS_LABELS[selected.client.associativeStatus]} · Responsável: {selected.client.ownerName}
                {selected.client.archivedAt ? " · Arquivado" : ""}
              </DialogDescription>
            </DialogHeader>
            <Tabs
              value={tab}
              onValueChange={(value) => replace({ tab: value === "info" ? null : String(value) })}
              className="min-h-0 flex-1 gap-4 overflow-y-auto p-4"
            >
              <TabsList className="w-full flex-wrap">
                <TabsTrigger value="info">Informações</TabsTrigger>
                <TabsTrigger value="edit">Editar</TabsTrigger>
                <TabsTrigger value="notes">Anotações ({selected.notes.length})</TabsTrigger>
                <TabsTrigger value="attachments">Anexos ({selected.attachments.length})</TabsTrigger>
                <TabsTrigger value="services">Atendimentos ({selected.services.length})</TabsTrigger>
                <TabsTrigger value="timeline">Linha do tempo</TabsTrigger>
              </TabsList>
              <TabsContent value="info">
                <ClientInfo client={selected.client} />
              </TabsContent>
              <TabsContent value="edit">
                <ClientEditForm client={selected.client} users={users} />
              </TabsContent>
              <TabsContent value="notes">
                <LeadNotes leadId={selected.client.leadId} notes={selected.notes} canEdit={selected.leadCanEdit} />
              </TabsContent>
              <TabsContent value="attachments">
                <LeadAttachments leadId={selected.client.leadId} attachments={selected.attachments} canEdit={selected.leadCanEdit} />
              </TabsContent>
              <TabsContent value="services">
                <ServiceRecords
                  clientId={selected.client.id}
                  records={selected.services}
                  canLog={selected.client.canLogService}
                  archived={selected.client.archivedAt !== null}
                  users={users}
                  currentUserId={currentUserId}
                  nowLocal={nowLocal}
                />
              </TabsContent>
              <TabsContent value="timeline">
                <TimelineView items={selected.timeline} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
