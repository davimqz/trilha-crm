"use client";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { LEAD_STATUS_LABELS, type LeadTab } from "../constants";
import type { AssignableUser, LeadAttachment, LeadDetail, LeadNote } from "../service";

import { LeadAttachments } from "./lead-attachments";
import { LeadEditForm } from "./lead-edit-form";
import { LeadInfo } from "./lead-info";
import { LeadNotes } from "./lead-notes";
import { useLeadsUrl } from "./use-leads-url";

export type SelectedLead = {
  lead: LeadDetail;
  notes: LeadNote[];
  attachments: LeadAttachment[];
};

type LeadSheetProps = { selected: SelectedLead | null; tab: LeadTab; users: AssignableUser[] };

export function LeadSheet({ selected, tab, users }: LeadSheetProps) {
  const { push, replace } = useLeadsUrl();
  const close = () => push({ lead: null, tab: null });

  return (
    <Sheet open={selected !== null} onOpenChange={(open) => !open && close()}>
      <SheetContent className="w-full gap-0 data-[side=right]:sm:max-w-3xl" aria-describedby={undefined}>
        {selected && (
          <>
            <SheetHeader className="border-b">
              <SheetTitle className="text-lg">{selected.lead.name}</SheetTitle>
              <SheetDescription>
                {LEAD_STATUS_LABELS[selected.lead.status]} · Responsável: {selected.lead.ownerName}
              </SheetDescription>
            </SheetHeader>
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
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
