import { listTurnovers } from '@/lib/turnover-storage';
import { browserAuthorization, privateHeaders, turnoverFailure } from '@/lib/turnover-http';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const denied = browserAuthorization(request); if (denied) return denied;
  try { return Response.json(await listTurnovers(), { headers: privateHeaders }); } catch (error) { return turnoverFailure(error); }
}
