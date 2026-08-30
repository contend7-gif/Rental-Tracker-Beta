import { getRequestUser, ownerFingerprint } from "@/lib/auth";
import { PDF_CHUNK_BYTES, storeChunkedUploadPart } from "@/lib/submissions";

export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string; part: string }> },
) {
  const user = getRequestUser(request);
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  const { id, part } = await context.params;
  const partNumber = Number(part);
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > PDF_CHUNK_BYTES) {
    return Response.json({ error: "This PDF piece is too large." }, { status: 413 });
  }
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength <= 0 || bytes.byteLength > PDF_CHUNK_BYTES) {
    return Response.json({ error: "This PDF piece is empty or too large." }, { status: 400 });
  }
  try {
    const stored = await storeChunkedUploadPart(id, await ownerFingerprint(user.email), partNumber, bytes);
    if (!stored) return Response.json({ error: "This PDF upload is no longer available." }, { status: 404 });
    return Response.json({ ok: true, partNumber });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "This PDF piece could not be saved." }, { status: 400 });
  }
}
