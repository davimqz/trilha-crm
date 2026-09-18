import { handleAttachmentUpload } from "@/modules/leads/http";

export async function POST(request: Request, { params }: RouteContext<"/api/leads/[leadId]/attachments">) {
  const { leadId } = await params;
  return handleAttachmentUpload(request, leadId);
}
