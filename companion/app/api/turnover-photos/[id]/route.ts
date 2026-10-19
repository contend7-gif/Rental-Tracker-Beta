import { readTurnoverPhoto } from '@/lib/turnover-storage';
import { browserAuthorization, turnoverFailure } from '@/lib/turnover-http';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = browserAuthorization(request); if (denied) return denied;
  try { return await readTurnoverPhoto((await context.params).id); } catch (error) { return turnoverFailure(error); }
}
