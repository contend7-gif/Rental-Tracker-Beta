import { getRequestUser } from '@/lib/auth';
import { readDesktopSnapshot } from '@/lib/snapshot-storage';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  if (!getRequestUser(request)) return Response.json({ error: 'Sign in is required.' }, { status: 401 });
  return Response.json(await readDesktopSnapshot(), { headers: { 'cache-control': 'private, no-store' } });
}
