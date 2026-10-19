import { getRequestUser } from './auth';
import { TurnoverError } from './turnover-storage';
export const privateHeaders = { 'cache-control': 'private, no-store' };
export function browserAuthorization(request: Request, write = false) {
  if (!getRequestUser(request)) return Response.json({ error: 'Sign in is required.' }, { status: 401, headers: privateHeaders });
  const origin = request.headers.get('origin');
  if (write && origin && origin !== new URL(request.url).origin) return Response.json({ error: 'Open the companion to save this change.' }, { status: 403, headers: privateHeaders });
  return null;
}
export function turnoverFailure(error: unknown) { return Response.json({ error: error instanceof Error ? error.message : 'Turnover could not be saved.' }, { status: error instanceof TurnoverError ? error.status : 500, headers: privateHeaders }); }
