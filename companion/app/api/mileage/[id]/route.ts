import { getRequestUser, ownerFingerprint } from "@/lib/auth";
import { deleteOwnerMileageEntry } from "@/lib/mileage";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = getRequestUser(request);
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  const { id } = await context.params;
  const deleted = await deleteOwnerMileageEntry(id, await ownerFingerprint(user.email));
  if (!deleted) return Response.json({ error: "Mileage entry was not found or is already in desktop review." }, { status: 404 });
  return Response.json({ ok: true });
}
