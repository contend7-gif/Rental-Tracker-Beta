import { cleanCaptureNote } from "@/lib/maintenance-report";
import { getRequestUser, ownerFingerprint } from "@/lib/auth";
import { deleteOwnerSubmission, updateOwnerSubmission, cleanOptionalText } from "@/lib/submissions";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = getRequestUser(request);
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  const { id } = await context.params;
  const deleted = await deleteOwnerSubmission(id, await ownerFingerprint(user.email));
  if (!deleted) {
    return Response.json({ error: "This capture can no longer be deleted." }, { status: 409 });
  }
  return new Response(null, { status: 204 });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = getRequestUser(request);
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  const raw = await request.text();
  if (raw.length > 16000) return Response.json({ error: "Capture details are too large." }, { status: 413 });
  let input: Record<string, unknown>;
  try { input = JSON.parse(raw); if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error(); }
  catch { return Response.json({ error: "Capture details must be valid JSON." }, { status: 400 }); }
  if (typeof input.expectedUpdatedAt !== "string") return Response.json({ error: "Refresh before editing this capture." }, { status: 400 });
  const text = (key: string, limit: number) => cleanOptionalText(typeof input[key] === "string" ? input[key] : null, limit);
  const { id } = await context.params;
  const submission = await updateOwnerSubmission(id, await ownerFingerprint(user.email), input.expectedUpdatedAt, { propertyLabel: text("propertyLabel", 120), unitLabel: text("unitLabel", 80), note: cleanCaptureNote(input.note) });
  if (!submission) return Response.json({ error: "This capture changed or was picked up by the desktop. Refresh your inbox; edits were not saved." }, { status: 409 });
  return Response.json({ submission });
}
