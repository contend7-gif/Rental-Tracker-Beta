import { requireDesktopAuthorization } from '@/lib/desktop-auth';
import { clearDesktopSnapshot, saveDesktopSnapshot } from '@/lib/snapshot-storage';
import { syncDesktopTurnovers, clearTurnovers } from '@/lib/turnover-storage';
import { normalizeDesktopSnapshot } from '@/lib/desktop-snapshot';
export const dynamic = 'force-dynamic';
export async function PUT(request: Request) {
  const unauthorized = await requireDesktopAuthorization(request);
  if (unauthorized) return unauthorized;
  const body = await request.text();
  if (body.length > 1_500_000) return Response.json({ error: 'Desktop snapshot is too large.' }, { status: 413 });
  try { const snapshot = normalizeDesktopSnapshot(JSON.parse(body)); const saved = await saveDesktopSnapshot(snapshot); const turnovers = await syncDesktopTurnovers(snapshot); return Response.json({ ok: true, generatedAt: saved.snapshot?.generatedAt, receivedAt: saved.receivedAt, turnovers }, { headers: { 'cache-control': 'private, no-store' } }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Snapshot could not be saved.' }, { status: 400 }); }
}
export async function DELETE(request: Request) {
  const unauthorized = await requireDesktopAuthorization(request);
  if (unauthorized) return unauthorized;
  await clearDesktopSnapshot();
  await clearTurnovers();
  return Response.json({ ok: true });
}
