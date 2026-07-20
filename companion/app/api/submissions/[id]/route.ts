import { getRequestUser, ownerFingerprint } from "@/lib/auth";
import { deleteOwnerSubmission } from "@/lib/submissions";

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
