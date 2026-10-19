import type { TurnoverChecklist, TurnoverPhoto } from './turnover-contract.ts';

// A desktop conflict choice may reference desktop files whose upload was deferred
// while that conflict was open. Only IDs from that trusted desktop candidate qualify.
export function validTurnoverPhotoLinks(checklist: TurnoverChecklist, previous: TurnoverChecklist | null, photos: Pick<TurnoverPhoto, 'id'>[], desktopCandidate: TurnoverChecklist | null = null) {
  const allowed = new Set([...photos.map(photo => photo.id), ...previous?.tasks.flatMap(task => task.photoIds) || [], ...desktopCandidate?.tasks.flatMap(task => task.photoIds) || []]);
  return checklist.tasks.every(task => task.photoIds.every(id => allowed.has(id)));
}
