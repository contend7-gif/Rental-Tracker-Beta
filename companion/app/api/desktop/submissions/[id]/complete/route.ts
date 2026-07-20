import { requireDesktopAuthorization } from "@/lib/desktop-auth";
import { completeSubmission } from "@/lib/submissions";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireDesktopAuthorization(request);
  if (unauthorized) return unauthorized;
  const { id } = await context.params;
  const submission = await completeSubmission(id);
  if (!submission) return Response.json({ error: "Capture was not found." }, { status: 404 });
  return Response.json({ submission });
}
