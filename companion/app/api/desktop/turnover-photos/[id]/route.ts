import { requireDesktopAuthorization } from '@/lib/desktop-auth';
import { readTurnoverPhoto, saveTurnoverPhoto } from '@/lib/turnover-storage';
import { privateHeaders, turnoverFailure } from '@/lib/turnover-http';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await requireDesktopAuthorization(request); if (denied) return denied;
  try { return await readTurnoverPhoto((await context.params).id); } catch (error) { return turnoverFailure(error); }
}
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await requireDesktopAuthorization(request); if (denied) return denied;
  try {
    const form = await request.formData(), file = form.get('file');
    if (!(file instanceof File)) return Response.json({ error: 'Choose a photo.' }, { status: 400 });
    return Response.json({ photo: await saveTurnoverPhoto(String(form.get('leaseId') || ''), (await context.params).id, file) }, { headers: privateHeaders });
  } catch (error) { return turnoverFailure(error); }
}
