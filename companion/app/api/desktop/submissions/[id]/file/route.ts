import { requireDesktopAuthorization } from "@/lib/desktop-auth";
import { getSubmissionFile } from "@/lib/submissions";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireDesktopAuthorization(request);
  if (unauthorized) return unauthorized;
  const { id } = await context.params;
  const result = await getSubmissionFile(id);
  if (!result) return Response.json({ error: "Capture file was not found." }, { status: 404 });

  const dispositionName = result.submission.originalFileName.replace(/["\r\n]/g, "_");
  return new Response(result.object.body, {
    headers: {
      "content-type": result.submission.contentType,
      "content-length": String(result.submission.byteSize),
      "content-disposition": `attachment; filename="${dispositionName}"`,
      "x-rental-submission": encodeURIComponent(JSON.stringify(result.submission)),
      "cache-control": "private, no-store",
    },
  });
}
