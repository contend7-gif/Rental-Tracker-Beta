export type TurnoverTask = { id: string; title: string; dueDate: string; completedAt: string; notes: string; photoIds: string[] };
export type TurnoverChecklist = { status: 'departing' | 'preparing' | 'ready'; tasks: TurnoverTask[] };
export type TurnoverPhoto = { id: string; leaseId: string; name: string; mimeType: string; byteSize: number; sha256: string };
export type TurnoverRecord = { leaseId: string; revision: number; checklist: TurnoverChecklist | null; updatedAt: string; syncedAt: string | null; conflict: { desktop: TurnoverChecklist | null; fields: string[] } | null; photos: TurnoverPhoto[] };
export const TURNOVER_TITLES = ['Inspect condition and take before photos', 'Clean kitchen, bathroom and living spaces', 'Wash and replace linens and towels', 'Check inventory and restock supplies', 'Complete repairs and check appliances', 'Check keys and access', 'Take after photos and confirm arrival readiness'];
export function blankTurnover(): TurnoverChecklist {
  return { status: 'departing', tasks: TURNOVER_TITLES.map((title, index) => ({ id: `turnover-task-${index + 1}`, title, dueDate: '', completedAt: '', notes: '', photoIds: [] })) };
}
const text = (value: unknown, limit: number) => typeof value === 'string' ? value.slice(0, limit) : '';
export const validTurnoverId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/.test(value);
const date = (value: unknown) => { const v = text(value, 10); return /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v ? v : ''; };
export function cleanTurnover(value: unknown): TurnoverChecklist | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const seen = new Set<string>();
  return { status: v.status === 'preparing' || v.status === 'ready' ? v.status : 'departing', tasks: (Array.isArray(v.tasks) ? v.tasks : []).slice(0, 100).flatMap(value => {
    if (!value || typeof value !== 'object') return [];
    const task = value as Record<string, unknown>;
    if (!validTurnoverId(task.id) || seen.has(task.id) || !text(task.title, 240).trim()) return [];
    seen.add(task.id);
    return [{ id: task.id, title: text(task.title, 240).trim(), dueDate: date(task.dueDate), completedAt: typeof task.completedAt === 'string' && Number.isFinite(Date.parse(task.completedAt)) ? new Date(task.completedAt).toISOString() : '', notes: text(task.notes, 4000), photoIds: [...new Set((Array.isArray(task.photoIds) ? task.photoIds : []).filter(validTurnoverId))].slice(0, 30) }];
  }) };
}
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export function mergeTurnover(base: TurnoverChecklist | null, desktop: TurnoverChecklist | null, phone: TurnoverChecklist | null): { checklist: TurnoverChecklist | null; conflicts: string[] } {
  if (equal(desktop, base)) return { checklist: phone, conflicts: [] };
  if (equal(phone, base) || equal(desktop, phone)) return { checklist: desktop, conflicts: [] };
  if (!desktop || !phone) return { checklist: phone, conflicts: ['Checklist'] };
  const conflicts: string[] = [];
  const choose = <T>(label: string, b: T | undefined, d: T, p: T): T => {
    if (equal(d, b) || equal(d, p)) return p;
    if (equal(p, b)) return d;
    conflicts.push(label); return p;
  };
  const ids = [...new Set([...phone.tasks.map(t => t.id), ...desktop.tasks.map(t => t.id)])];
  const tasks = ids.map(id => {
    const b = base?.tasks.find(t => t.id === id), d = desktop.tasks.find(t => t.id === id), p = phone.tasks.find(t => t.id === id);
    if (!d) return p!;
    if (!p) return d;
    const photos = [...new Set([...p.photoIds, ...d.photoIds])].filter(photoId => !b?.photoIds.includes(photoId) || (p.photoIds.includes(photoId) && d.photoIds.includes(photoId)));
    return { id, title: choose(`${p.title}: title`, b?.title, d.title, p.title), dueDate: choose(`${p.title}: due date`, b?.dueDate, d.dueDate, p.dueDate), completedAt: d.completedAt && p.completedAt ? p.completedAt : choose(`${p.title}: completion`, b?.completedAt, d.completedAt, p.completedAt), notes: choose(`${p.title}: notes`, b?.notes, d.notes, p.notes), photoIds: photos };
  });
  return { checklist: { status: choose('Readiness status', base?.status, desktop.status, phone.status), tasks }, conflicts };
}
