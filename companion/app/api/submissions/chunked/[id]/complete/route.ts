import { getRequestUser, ownerFingerprint } from "@/lib/auth";
import { completeChunkedUpload } from "@/lib/submissions";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = getRequestUser(request);
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  const { id } = await context.params;
  try {
    const submission = await completeChunkedUpload(id, await ownerFingerprint(user.email));
    if (!submission) return Response.json({ error: "This PDF upload is no longer available." }, { status: 404 });
    return Response.json({ submission }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "This PDF could not be completed." }, { status: 400 });
  }
}
