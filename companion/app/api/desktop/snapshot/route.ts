import { requireDesktopAuthorization } from '@/lib/desktop-auth';
import { clearDesktopSnapshot, saveDesktopSnapshot } from '@/lib/snapshot-storage';
export const dynamic = 'force-dynamic';
export async function PUT(request: Request) {
  const unauthorized = await requireDesktopAuthorization(request);
  if (unauthorized) return unauthorized;
  const body = await request.text();
  if (body.length > 1_500_000) return Response.json({ error: 'Desktop snapshot is too large.' }, { status: 413 });
  try { const saved = await saveDesktopSnapshot(JSON.parse(body)); return Response.json({ ok: true, generatedAt: saved.snapshot?.generatedAt, receivedAt: saved.receivedAt }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Snapshot could not be saved.' }, { status: 400 }); }
}
export async function DELETE(request: Request) {
  const unauthorized = await requireDesktopAuthorization(request);
  if (unauthorized) return unauthorized;
  await clearDesktopSnapshot();
  return Response.json({ ok: true });
}
