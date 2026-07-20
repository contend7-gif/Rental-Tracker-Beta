import { requireDesktopAuthorization } from "@/lib/desktop-auth";
import { claimSubmission } from "@/lib/submissions";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireDesktopAuthorization(request);
  if (unauthorized) return unauthorized;
  const { id } = await context.params;
  const submission = await claimSubmission(id);
  if (!submission || submission.status === "imported") {
    return Response.json({ error: "Capture is unavailable." }, { status: 404 });
  }
  return Response.json({ submission });
}
