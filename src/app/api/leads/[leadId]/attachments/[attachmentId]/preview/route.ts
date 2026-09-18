import { handleAttachmentPreview } from "@/modules/leads/http";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/leads/[leadId]/attachments/[attachmentId]/preview">,
) {
  const { leadId, attachmentId } = await params;
  return handleAttachmentPreview(leadId, attachmentId);
}
