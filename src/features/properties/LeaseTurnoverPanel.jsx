import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { createLeaseTurnover } from "../../domain/leaseTurnover.ts";

export function LeaseTurnoverPanel({ lease, setLeaseDraft, savedLease, canEdit, documents, todayIso, onAttachPhoto, openDocumentPreview, onBusyChange }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [newTask, setNewTask] = useState("");
  const turnover = lease.turnover;
  const photos = documents.filter((document) => ["image/jpeg", "image/png", "image/webp"].includes(document.mimeType));
  const update = (change) => {
    setMessage("");
    setLeaseDraft((draft) => ({ ...draft, turnover: change(draft.turnover) }));
  };
  const updateTask = (id, patch) => update((current) => ({ ...current,
    tasks: current.tasks.map((task) => task.id === id ? { ...task, ...patch } : task),
  }));
  const completed = turnover?.tasks.filter((task) => task.completedAt).length || 0;
  const dirty = JSON.stringify(turnover) !== JSON.stringify(savedLease?.turnover);
  const run = async (action) => {
    setBusy(true);
    onBusyChange(true);
    setMessage("");
    try { await action(); } catch (error) { setMessage(error.message || "Could not save. Try again."); }
    finally { setBusy(false); onBusyChange(false); }
  };

  return <section aria-label="Lease turnover" className="mt-4 space-y-3">
    <div><h3 className="text-base font-semibold text-slate-900">Prepare for the next stay</h3><p className="mt-1 text-xs text-slate-500">Track work after this tenant's departure. Save checklist changes here; photos are kept in this lease's Documents.</p></div>
    {!savedLease ? <p className="text-sm text-slate-600">Save the lease before starting a turnover.</p> : !turnover ? <div className="rounded-lg border border-dashed border-teal-200 bg-teal-50/40 p-4"><p className="mb-3 text-sm text-slate-600">Start with the furnished-rental checklist, then add tasks for this stay.</p><Button disabled={!canEdit} onClick={() => update(() => createLeaseTurnover())}>Start turnover checklist</Button></div> : <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-teal-200 bg-teal-50/50 p-3">
        <div><strong className="text-sm text-slate-900">{completed} of {turnover.tasks.length} complete</strong><div className="mt-1 text-xs text-slate-500">{dirty ? "Unsaved checklist changes" : "No pending checklist edits"}</div></div>
        <label className="text-xs text-slate-600">Turnover status<select aria-label="Turnover status" className="ml-2 rounded-md border border-slate-300 bg-white px-2 py-2 text-sm" value={turnover.status} disabled={!canEdit || busy} onChange={(event) => update((current) => ({ ...current, status: event.target.value }))}><option value="departing">Departing</option><option value="preparing">Preparing</option><option value="ready">Ready for arrival</option></select></label>
      </div>
      {turnover.status === "ready" && completed < turnover.tasks.length && <p className="text-xs text-amber-800">Marked ready with unfinished tasks. Review the remaining work before arrival.</p>}
      <fieldset disabled={!canEdit || busy} className="space-y-3">
        <legend className="sr-only">Turnover tasks</legend>
        {turnover.tasks.map((task) => <article key={task.id} className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-3"><label className="flex min-w-0 items-start gap-2 text-sm font-medium text-slate-800"><input type="checkbox" className="mt-1" checked={Boolean(task.completedAt)} onChange={(event) => updateTask(task.id, { completedAt: event.target.checked ? new Date().toISOString() : "" })} /><span className={task.completedAt ? "text-slate-500 line-through" : ""}>{task.title}</span></label><label className="text-xs text-slate-500">Due date<Input aria-label={`Due date: ${task.title}`} type="date" className="mt-1 !h-8 w-36" value={task.dueDate} onChange={(event) => updateTask(task.id, { dueDate: event.target.value })} /></label></div>
          {task.dueDate && !task.completedAt && task.dueDate < todayIso && <p className="mt-1 text-xs font-medium text-amber-800">Overdue since {task.dueDate}</p>}
          <label className="mt-2 block text-xs text-slate-500">Notes<textarea aria-label={`Notes: ${task.title}`} rows={2} className="mt-1 w-full rounded-md border border-slate-200 p-2 text-sm text-slate-800" placeholder="Condition, supplies or follow-up" value={task.notes} onChange={(event) => updateTask(task.id, { notes: event.target.value })} /></label>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="text-xs text-slate-600">Add photo<input aria-label={`Add photo: ${task.title}`} type="file" accept="image/jpeg,image/png,image/webp" className="ml-2 max-w-full text-xs" onChange={(event) => {
              const file = event.target.files?.[0]; event.target.value = "";
              if (file) void run(async () => { const id = await onAttachPhoto(file); update((current) => ({ ...current, tasks: current.tasks.map((item) => item.id === task.id ? { ...item, photoIds: [...item.photoIds, id] } : item) })); });
            }} /></label>
            {photos.some((photo) => !task.photoIds.includes(photo.id)) && <select aria-label={`Link existing photo: ${task.title}`} className="max-w-full rounded border border-slate-200 p-1 text-xs" value="" onChange={(event) => updateTask(task.id, { photoIds: [...task.photoIds, event.target.value] })}><option value="" disabled>Link existing lease photo…</option>{photos.filter((photo) => !task.photoIds.includes(photo.id)).map((photo) => <option key={photo.id} value={photo.id}>{photo.name}</option>)}</select>}
          </div>
          {task.photoIds.map((id) => { const photo = photos.find((item) => item.id === id); return <div key={id} className="mt-2 flex flex-wrap items-center gap-2 rounded border border-slate-100 p-2 text-xs"><span className="min-w-0 flex-1 break-words">{photo?.name || "Photo no longer available"}</span>{photo && <Button size="sm" variant="secondary" onClick={() => openDocumentPreview(photo)}>View photo</Button>}<Button size="sm" variant="ghost" onClick={() => updateTask(task.id, { photoIds: task.photoIds.filter((item) => item !== id) })}>Unlink</Button></div>; })}
        </article>)}
        <div className="flex gap-2"><Input aria-label="New turnover task" placeholder="Add a task for this stay" value={newTask} onChange={(event) => setNewTask(event.target.value)} /><Button variant="secondary" disabled={!newTask.trim()} onClick={() => { update((current) => ({ ...current, tasks: [...current.tasks, { id: crypto.randomUUID(), title: newTask.trim(), dueDate: "", completedAt: "", notes: "", photoIds: [] }] })); setNewTask(""); }}>Add task</Button></div>
      </fieldset>
    </>}
    {message && <p role="status" className="text-sm text-slate-700">{message}</p>}
    {busy && <p role="status" className="text-xs text-slate-500">Keep this lease open until the operation finishes.</p>}
  </section>;
}
