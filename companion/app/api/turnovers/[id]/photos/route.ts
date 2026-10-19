import { saveTurnoverPhoto } from '@/lib/turnover-storage';
import { browserAuthorization, privateHeaders, turnoverFailure } from '@/lib/turnover-http';
export const dynamic = 'force-dynamic';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = browserAuthorization(request, true); if (denied) return denied;
  try {
    const form = await request.formData(), file = form.get('file');
    if (!(file instanceof File)) return Response.json({ error: 'Choose a photo.' }, { status: 400 });
    return Response.json({ photo: await saveTurnoverPhoto((await context.params).id, String(form.get('id') || ''), file) }, { headers: privateHeaders });
  } catch (error) { return turnoverFailure(error); }
}
