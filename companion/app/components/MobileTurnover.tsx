'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { blankTurnover, cleanTurnover, mergeTurnover, type TurnoverChecklist, type TurnoverRecord, type TurnoverTask } from '@/lib/turnover-contract';
import { prepareTurnoverPhoto } from '@/lib/turnover-photo';

type Lease = { id: string; propertyId: string; propertyName: string; unit: string; tenantName: string; endDate: string };
type Overview = { supported: boolean; generatedAt: string | null; leases: Lease[]; records: TurnoverRecord[] };
type Draft = { leaseId: string; revision: number; base: TurnoverChecklist | null; checklist: TurnoverChecklist };
type PendingPhoto = { id: string; taskId: string; file: File };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const localDay = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; };
function SelectedPhoto({ file }: { file: File }) {
  const [url, setUrl] = useState('');
  useEffect(() => { const value = URL.createObjectURL(file); setUrl(value); return () => URL.revokeObjectURL(value); }, [file]);
  return url ? <img src={url} alt={`Selected photo: ${file.name}`} /> : null;
}
export function MobileTurnover({ active, draftOwner }: { active: boolean; draftOwner: string }) {
  const [overview, setOverview] = useState<Overview | null>(null), [leaseId, setLeaseId] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null), [pending, setPending] = useState<PendingPhoto[]>([]);
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const [newTask, setNewTask] = useState(''), [changedElsewhere, setChangedElsewhere] = useState<TurnoverRecord | null>(null);
  const selectedLeaseRef = useRef(leaseId); selectedLeaseRef.current = leaseId;
  const inFlight = useRef(false), draftRef = useRef(draft), pendingRef = useRef(pending), saving = useRef(false);
  draftRef.current = draft; pendingRef.current = pending;
  const key = (id: string) => `rental-companion:turnover:v1:${draftOwner}:${id}`;
  const dirty = Boolean(draft && !same(draft.base, draft.checklist));
  const record = overview?.records.find(r => r.leaseId === leaseId), lease = overview?.leases.find(l => l.id === leaseId);
  const readDraft = (id: string, saved: TurnoverRecord) => {
    let remembered: Draft | null = null;
    try {
      const value = JSON.parse(localStorage.getItem(key(id)) || 'null');
      if (value?.leaseId === id && Number.isInteger(value.revision) && cleanTurnover(value.checklist)) remembered = { leaseId: id, revision: value.revision, base: cleanTurnover(value.base), checklist: cleanTurnover(value.checklist)! };
    } catch { /* A damaged phone draft never changes the saved checklist. */ }
    if (remembered) {
      const merged = mergeTurnover(remembered.base, remembered.checklist, saved.checklist);
      if (!merged.conflicts.length && merged.checklist) { remembered = { ...remembered, revision: saved.revision, base: saved.checklist, checklist: merged.checklist }; setChangedElsewhere(null); }
      else setChangedElsewhere(saved);
      setMessage('Phone text draft restored. Reselect any unsent photos.'); return remembered;
    }
    setChangedElsewhere(null);
    return saved.checklist ? { leaseId: id, revision: saved.revision, base: saved.checklist, checklist: saved.checklist } : null;
  };
  const load = useCallback(async () => {
    if (inFlight.current || saving.current) return;
    inFlight.current = true; setLoading(true);
    try {
      const response = await fetch('/api/turnovers', { cache: 'no-store' }); const data = await response.json() as Overview & { error?: string };
      if (!response.ok) throw new Error(data.error || 'Checklists could not refresh.');
      setOverview(data); setError('');
      const current = draftRef.current;
      if (!current && selectedLeaseRef.current) {
        const latest = data.records.find(r => r.leaseId === selectedLeaseRef.current);
        if (latest?.checklist) setDraft({ leaseId: latest.leaseId, revision: latest.revision, base: latest.checklist, checklist: latest.checklist });
      }
      if (current) {
        const latest = (data as Overview).records.find(r => r.leaseId === current.leaseId);
        if (latest && latest.revision !== current.revision) {
          const merged = mergeTurnover(current.base, current.checklist, latest.checklist);
          if (!merged.conflicts.length && merged.checklist) { setDraft({ ...current, revision: latest.revision, base: latest.checklist, checklist: merged.checklist }); setChangedElsewhere(null); }
          else { setChangedElsewhere(latest); setMessage('This checklist changed elsewhere. Your phone draft is preserved below.'); }
        }
      }
    } catch (error) { setError(error instanceof Error ? error.message : 'Checklists could not refresh.'); }
    finally { setLoading(false); inFlight.current = false; }
  }, []);
  useEffect(() => { if (!active) return; void load(); const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 30_000); const online = () => void load(); window.addEventListener('online', online); return () => { clearInterval(timer); window.removeEventListener('online', online); }; }, [active, load]);
  useEffect(() => {
    if (!draft) return;
    try { if (same(draft.base, draft.checklist)) localStorage.removeItem(key(draft.leaseId)); else localStorage.setItem(key(draft.leaseId), JSON.stringify(draft)); }
    catch { setError('Phone draft storage is unavailable. Keep this page open until you save.'); }
  }, [draft, draftOwner]);
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => { if (saving.current || pendingRef.current.length || (draftRef.current && !same(draftRef.current.base, draftRef.current.checklist))) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', protect); return () => window.removeEventListener('beforeunload', protect);
  }, []);
  const chooseLease = (id: string) => {
    if (pending.length || busy) return;
    setLeaseId(id); setError(''); setMessage(''); setNewTask('');
    const saved = overview?.records.find(r => r.leaseId === id);
    setDraft(saved ? readDraft(id, saved) : null);
  };
  const editTask = (id: string, change: Partial<TurnoverTask>) => setDraft(current => current ? { ...current, checklist: { ...current.checklist, tasks: current.checklist.tasks.map(t => t.id === id ? { ...t, ...change } : t) } } : current);
  const selectPhotos = (taskId: string, files: FileList | null) => {
    if (!files?.length) return;
    const chosen = Array.from(files);
    const task = draft?.checklist.tasks.find(t => t.id === taskId);
    if ((task?.photoIds.length || 0) + pending.filter(p => p.taskId === taskId).length + chosen.length > 30) { setError("Keep up to 30 photos per task."); return; }
    if (chosen.length > 8 || pending.length + chosen.length > 16 || chosen.some(f => !f.type.startsWith('image/') || f.size > 30 * 1024 * 1024)) { setError('Select up to eight photos at once, up to 30 MB each. Save the selected photos before adding more.'); return; }
    setPending(current => [...current, ...chosen.map(file => ({ id: `turnover-photo-${crypto.randomUUID()}`, taskId, file }))]); setError('');
  };
  async function save(resolve?: 'phone' | 'desktop') {
    if (!draftRef.current || saving.current || changedElsewhere) return;
    saving.current = true; setBusy(true); setError(''); setMessage('Saving…');
    let work = draftRef.current;
    try {
      for (const photo of pendingRef.current) {
        setMessage(`Uploading ${photo.file.name}…`);
        const file = await prepareTurnoverPhoto(photo.file), form = new FormData(); form.set('id', photo.id); form.set('file', file);
        const response = await fetch(`/api/turnovers/${encodeURIComponent(work.leaseId)}/photos`, { method: 'POST', body: form }); const body = await response.json() as { error?: string; photo: TurnoverRecord["photos"][number]; record: TurnoverRecord };
        if (!response.ok) throw new Error(body.error || 'Photo upload failed. Retry Save turnover.');
        work = { ...work, checklist: { ...work.checklist, tasks: work.checklist.tasks.map(t => t.id === photo.taskId ? { ...t, photoIds: [...new Set([...t.photoIds, photo.id])] } : t) } };
        setDraft(work); draftRef.current = work;
        setPending(current => current.filter(p => p.id !== photo.id));
        setOverview(current => current ? { ...current, records: current.records.map(r => r.leaseId === work.leaseId ? { ...r, photos: [...r.photos.filter(p => p.id !== photo.id), body.photo] } : r) } : current);
      }
      const response = await fetch(`/api/turnovers/${encodeURIComponent(work.leaseId)}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ revision: work.revision, checklist: work.checklist, resolve }) });
      const body = await response.json() as { error?: string; photo: TurnoverRecord["photos"][number]; record: TurnoverRecord };
      if (!response.ok) throw new Error(body.error || 'Checklist save failed. Your draft is kept on this phone.');
      const saved = body.record as TurnoverRecord;
      setOverview(current => current ? { ...current, records: current.records.map(r => r.leaseId === work.leaseId ? saved : r) } : current);
      setDraft(saved.checklist ? { leaseId: work.leaseId, revision: saved.revision, base: saved.checklist, checklist: saved.checklist } : null);
      setMessage('Saved to your private companion. Desktop sync pending.');
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not save. Retry without leaving this page.'); setMessage(''); }
    finally { saving.current = false; setBusy(false); }
  }
  const completed = draft?.checklist.tasks.filter(t => t.completedAt).length || 0;
  const stale = overview?.generatedAt && Date.now() - Date.parse(overview.generatedAt) > 24 * 60 * 60 * 1000;
  return <section hidden={!active} className="turnover-panel" aria-labelledby="turnover-title">
    <div className="section-heading"><div><p className="step-label">BETWEEN STAYS</p><h2 id="turnover-title">Turnover checklists</h2></div><button className="secondary-button" type="button" onClick={() => void load()} disabled={loading || busy}>{loading ? 'Refreshing…' : 'Refresh'}</button></div>
    {error && <p className="alert error" role="alert">{error}</p>}
    {overview && !overview.supported && <div className="snapshot-empty"><h3>Connect your desktop checklists</h3><p>Update Rental Tracker to v1.11.5 or later, then enable Phone overview &amp; turnover sync in Settings → Mobile companion. Open the desktop app and use Sync snapshot now.</p></div>}
    {overview?.supported && <>
      <p className="snapshot-stamp">Last desktop check-in: {overview.generatedAt ? new Date(overview.generatedAt).toLocaleString() : 'Waiting'}. Phone saves work while your desktop is closed.</p>
      {stale && <p className="alert">The desktop lease list is over a day old. Confirm the selected tenant and unit before starting work.</p>}
      <label className="turnover-lease-picker">Lease / departing tenant<select aria-label="Turnover lease" value={leaseId} disabled={busy || pending.length > 0} onChange={event => chooseLease(event.target.value)}><option value="">Choose a lease</option>{overview.leases.map(l => <option key={l.id} value={l.id}>{l.propertyName} · {l.unit} · {l.tenantName || 'Tenant'}{l.endDate ? ` · ends ${l.endDate}` : ''}</option>)}</select></label>
      {!overview.leases.length && <p>No shared leases yet. Refresh after the desktop checks in.</p>}
      {lease && <div className="turnover-identity"><strong>{lease.propertyName} · {lease.unit}</strong><span>{lease.tenantName || 'Tenant'}{lease.endDate ? ` · expected end ${lease.endDate}` : ''}</span></div>}
      {lease && !record && <p>This lease is waiting for its first checklist sync. Refresh shortly.</p>}
      {record && !draft && !record.checklist && <div className="snapshot-empty"><p>Use the seven-step furnished-rental checklist and add any work for this stay.</p><button type="button" className="primary-button" onClick={() => setDraft({ leaseId, revision: record.revision, base: null, checklist: blankTurnover() })}>Start turnover checklist</button></div>}
      {draft && record && <>
        <div className="turnover-progress"><strong>{completed} of {draft.checklist.tasks.length} complete</strong><progress aria-label="Turnover progress" max={draft.checklist.tasks.length || 1} value={completed} /><label>Readiness<select aria-label="Turnover readiness" disabled={busy} value={draft.checklist.status} onChange={event => setDraft({ ...draft, checklist: { ...draft.checklist, status: event.target.value as TurnoverChecklist['status'] } })}><option value="departing">Departing</option><option value="preparing">Preparing</option><option value="ready">Ready for arrival</option></select></label><span>{dirty ? 'Unsaved changes · text draft kept on this phone' : record.syncedAt ? `Desktop confirmed ${new Date(record.syncedAt).toLocaleString()}` : 'Saved on companion · desktop sync pending'}</span></div>
        {draft.checklist.status === 'ready' && completed !== draft.checklist.tasks.length && <p className="alert">Marked ready with unfinished work. Review remaining tasks before arrival.</p>}
        {changedElsewhere && <div className="turnover-conflict" role="alert"><h3>Your phone draft overlaps a newer save</h3><p>Review the latest saved checklist before choosing which version to keep.</p><details><summary>Latest saved checklist</summary>{changedElsewhere.checklist?.tasks.map(t => <p key={t.id}>{t.completedAt ? '✓' : '○'} {t.title}{t.notes ? ` — ${t.notes}` : ''}{t.dueDate ? ` · due ${t.dueDate}` : ''}</p>)}</details><button type="button" className="secondary-button" disabled={busy} onClick={() => { setDraft({ ...draft, revision: changedElsewhere.revision, base: changedElsewhere.checklist }); setChangedElsewhere(null); }}>Keep my phone draft</button><button type="button" className="secondary-button" disabled={busy || pending.length > 0} onClick={() => { setDraft(changedElsewhere.checklist ? { leaseId, revision: changedElsewhere.revision, base: changedElsewhere.checklist, checklist: changedElsewhere.checklist } : null); setChangedElsewhere(null); }}>Use latest saved checklist</button></div>}
        {record.conflict && !changedElsewhere && <div className="turnover-conflict" role="alert"><h3>Phone and desktop changed the same work</h3><p>{record.conflict.fields.join('; ')}</p><details><summary>Review desktop version</summary><p>Status: {record.conflict.desktop?.status || 'No checklist'}</p>{record.conflict.desktop?.tasks.map(t => <p key={t.id}>{t.completedAt ? '✓' : '○'} {t.title}{t.notes ? ` — ${t.notes}` : ''}{t.dueDate ? ` · due ${t.dueDate}` : ''}</p>)}</details><p>Your phone version appears below. Choose one explicitly to resume sync.</p><button className="secondary-button" type="button" disabled={busy} onClick={() => void save('phone')}>Use phone version</button><button className="secondary-button" type="button" disabled={busy || pending.length > 0} onClick={() => void save('desktop')}>Use desktop version</button></div>}
        <fieldset disabled={busy} className="turnover-tasks"><legend className="sr-only">Turnover tasks</legend>{draft.checklist.tasks.map(task => <article className={`turnover-task${task.completedAt ? ' completed' : ''}`} key={task.id}>
          <label className="turnover-check"><input type="checkbox" checked={Boolean(task.completedAt)} onChange={event => editTask(task.id, { completedAt: event.target.checked ? new Date().toISOString() : '' })} /><span>{task.title}</span></label>
          {task.dueDate && <p className={!task.completedAt && task.dueDate < localDay() ? 'turnover-overdue' : 'snapshot-help'}>{!task.completedAt && task.dueDate < localDay() ? 'Overdue · ' : 'Due '}{task.dueDate}</p>}
          <details><summary>Notes, date &amp; photos{task.photoIds.length ? ` · ${task.photoIds.length} photos` : ''}</summary><div className="turnover-task-fields"><label>Due date<input aria-label={`Due date: ${task.title}`} type="date" value={task.dueDate} onChange={event => editTask(task.id, { dueDate: event.target.value })} /></label><label>Notes<textarea aria-label={`Notes: ${task.title}`} rows={3} maxLength={4000} value={task.notes} placeholder="Condition, supplies, or follow-up" onChange={event => editTask(task.id, { notes: event.target.value })} /></label>
            <div className="turnover-camera-actions"><label className="secondary-button">Take photo<input aria-label={`Take photo: ${task.title}`} type="file" accept="image/*" capture="environment" onChange={event => { selectPhotos(task.id, event.target.files); event.target.value = ''; }} /></label><label className="secondary-button">Choose photos<input aria-label={`Choose photos: ${task.title}`} type="file" accept="image/*" multiple onChange={event => { selectPhotos(task.id, event.target.files); event.target.value = ''; }} /></label></div>
            <div className="turnover-photos">{task.photoIds.map(id => { const photo = record.photos.find(p => p.id === id); return <div key={id}>{photo ? <a href={`/api/turnover-photos/${encodeURIComponent(id)}`} target="_blank" rel="noreferrer"><img src={`/api/turnover-photos/${encodeURIComponent(id)}`} alt={photo.name} loading="lazy" /><span>View {photo.name}</span></a> : <p>Photo is still on desktop. Open the updated desktop app to share it.</p>}<button type="button" className="text-button" onClick={() => editTask(task.id, { photoIds: task.photoIds.filter(p => p !== id) })}>Unlink photo</button></div>; })}{pending.filter(p => p.taskId === task.id).map(photo => <div key={photo.id}><SelectedPhoto file={photo.file} /><span>{photo.file.name} · not uploaded</span><button type="button" className="text-button" onClick={() => setPending(current => current.filter(p => p.id !== photo.id))}>Remove selected photo</button></div>)}</div>
          </div></details>
        </article>)}<div className="turnover-add-task"><label>Additional task<input aria-label="New mobile turnover task" maxLength={240} value={newTask} onChange={event => setNewTask(event.target.value)} placeholder="e.g. Replace spare towels" /></label><button className="secondary-button" type="button" disabled={!newTask.trim() || draft.checklist.tasks.length >= 100} onClick={() => { setDraft({ ...draft, checklist: { ...draft.checklist, tasks: [...draft.checklist.tasks, { id: crypto.randomUUID(), title: newTask.trim(), dueDate: '', completedAt: '', notes: '', photoIds: [] }] } }); setNewTask(''); }}>Add task</button></div></fieldset>
        <div className="turnover-save"><div><span>{pending.length ? `${pending.length} photos selected · save before changing lease` : dirty ? 'Text draft kept on this phone' : 'Checklist saved'}</span>{message && <p role="status">{message}</p>}{error && <p className="turnover-overdue">{error}</p>}</div><button className="primary-button" type="button" disabled={busy || Boolean(changedElsewhere) || Boolean(record.conflict)} onClick={() => void save()}>{busy ? 'Saving…' : 'Save turnover'}</button></div>
      </>}
    </>}
  </section>;
}
