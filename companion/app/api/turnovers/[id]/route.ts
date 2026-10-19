import { savePhoneTurnover, TurnoverError } from '@/lib/turnover-storage';
import { browserAuthorization, privateHeaders, turnoverFailure } from '@/lib/turnover-http';
export const dynamic = 'force-dynamic';
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = browserAuthorization(request, true); if (denied) return denied;
  try {
    const body = await request.text(); if (body.length > 600_000) throw new TurnoverError('This checklist is too large.', 413);
    const { id } = await context.params;
    return Response.json({ record: await savePhoneTurnover(id, JSON.parse(body)) }, { headers: privateHeaders });
  } catch (error) { return turnoverFailure(error); }
}
