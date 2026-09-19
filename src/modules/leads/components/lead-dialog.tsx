"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { LEAD_STATUS_LABELS, type LeadTab } from "../constants";
import type { AssignableUser, LeadAttachment, LeadDetail, LeadNote } from "../service";
import type { TimelineItem } from "../timeline";

import { LeadAttachments } from "./lead-attachments";
import { LeadEditForm } from "./lead-edit-form";
import { LeadInfo } from "./lead-info";
import { LeadNotes } from "./lead-notes";
import { TimelineView } from "./timeline-view";
import { useLeadsUrl } from "./use-leads-url";

export type SelectedLead = {
  lead: LeadDetail;
  notes: LeadNote[];
  attachments: LeadAttachment[];
  timeline: TimelineItem[];
};

type LeadDialogProps = { selected: SelectedLead | null; tab: LeadTab; users: AssignableUser[] };

// Card do lead em modal centralizado (cabeçalho fixo; o conteúdo das abas rola dentro do modal)
export function LeadDialog({ selected, tab, users }: LeadDialogProps) {
  const { push, replace } = useLeadsUrl();
  const close = () => push({ lead: null, tab: null });

  return (
    <Dialog open={selected !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-3xl" data-testid="lead-dialog">
        {selected && (
          <>
            <DialogHeader className="border-b p-4 pr-12">
              <DialogTitle className="text-lg">{selected.lead.name}</DialogTitle>
              <DialogDescription>
                {LEAD_STATUS_LABELS[selected.lead.status]} · Responsável: {selected.lead.ownerName}
              </DialogDescription>
            </DialogHeader>
            <Tabs
              value={tab}
              onValueChange={(value) => replace({ tab: value === "info" ? null : String(value) })}
              className="min-h-0 flex-1 gap-4 overflow-y-auto p-4"
            >
              <TabsList className="w-full">
                <TabsTrigger value="info">Informações</TabsTrigger>
                <TabsTrigger value="edit">Editar</TabsTrigger>
                <TabsTrigger value="notes">Anotações ({selected.notes.length})</TabsTrigger>
                <TabsTrigger value="attachments">Anexos ({selected.attachments.length})</TabsTrigger>
                <TabsTrigger value="timeline">Linha do tempo</TabsTrigger>
              </TabsList>
              <TabsContent value="info">
                <LeadInfo lead={selected.lead} />
              </TabsContent>
              <TabsContent value="edit">
                <LeadEditForm lead={selected.lead} users={users} onDeleted={close} />
              </TabsContent>
              <TabsContent value="notes">
                <LeadNotes leadId={selected.lead.id} notes={selected.notes} canEdit={selected.lead.canEdit} />
              </TabsContent>
              <TabsContent value="attachments">
                <LeadAttachments leadId={selected.lead.id} attachments={selected.attachments} canEdit={selected.lead.canEdit} />
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
