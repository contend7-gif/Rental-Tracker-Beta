import { requireDesktopAuthorization } from "@/lib/desktop-auth";
import { deleteDesktopSubmission } from "@/lib/submissions";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireDesktopAuthorization(request);
  if (unauthorized) return unauthorized;
  const { id } = await context.params;
  const deleted = await deleteDesktopSubmission(id);
  if (!deleted) {
    return Response.json({ error: "This capture was already imported or removed." }, { status: 409 });
  }
  return new Response(null, { status: 204 });
}
