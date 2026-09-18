import { handleAttachmentDownload } from "@/modules/leads/http";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/leads/[leadId]/attachments/[attachmentId]">,
) {
  const { leadId, attachmentId } = await params;
  return handleAttachmentDownload(leadId, attachmentId);
}
