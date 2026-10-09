import { getRequestUser, ownerFingerprint } from "@/lib/auth";
import { deleteOwnerMileageEntry, updateOwnerMileageEntry, validateMileageInput } from "@/lib/mileage";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = getRequestUser(request);
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  const { id } = await context.params;
  const deleted = await deleteOwnerMileageEntry(id, await ownerFingerprint(user.email));
  if (!deleted) return Response.json({ error: "Mileage entry was not found or is already in desktop review." }, { status: 404 });
  return Response.json({ ok: true });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = getRequestUser(request);
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  const raw = await request.text();
  if (raw.length > 16000) return Response.json({ error: "Trip details are too large." }, { status: 413 });
  let input: Record<string, unknown>;
  try { input = JSON.parse(raw); if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error(); }
  catch { return Response.json({ error: "Trip details must be valid JSON." }, { status: 400 }); }
  if (typeof input.expectedUpdatedAt !== "string") return Response.json({ error: "Refresh before editing this trip." }, { status: 400 });
  const result = validateMileageInput(input);
  if (result.error || !result.input) return Response.json({ error: result.error }, { status: 400 });
  const { id } = await context.params;
  const mileageEntry = await updateOwnerMileageEntry(id, await ownerFingerprint(user.email), input.expectedUpdatedAt, result.input);
  if (!mileageEntry) return Response.json({ error: "This trip changed or was picked up by the desktop. Refresh your inbox; edits were not saved." }, { status: 409 });
  return Response.json({ mileageEntry });
}
