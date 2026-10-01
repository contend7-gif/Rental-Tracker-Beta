import { useId } from "react";
import { useWorkspaceMemory } from "../../app/WorkspaceMemory.jsx";
import { Button } from "../../components/ui/button";
import { recordPage } from "../../app/recordPage.ts";

export function useRecordPage(records, resetKey, pageSize = 50, memoryKey) {
  const instanceId = useId();
  const [selection, setSelection] = useWorkspaceMemory(`pager:${memoryKey || instanceId}`, { key: resetKey, page: 0 });
  const page = recordPage(records, selection.key === resetKey ? selection.page : 0, pageSize);
  return { ...page, onPageChange: (next) => setSelection({ key: resetKey, page: next }) };
}

export function RecordPager({ page, pageCount, start, end, total, onPageChange, label }) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label={`${label} pages`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
      <span className="text-xs text-slate-600" role="status">{start + 1}–{end} of {total} {label.toLowerCase()}</span>
      <div className="flex items-center gap-2">
        <Button variant="secondary" disabled={page === 0} onClick={() => onPageChange(page - 1)}>Previous</Button>
        <span className="text-xs text-slate-500">Page {page + 1} of {pageCount}</span>
        <Button variant="secondary" disabled={page + 1 >= pageCount} onClick={() => onPageChange(page + 1)}>Next</Button>
      </div>
    </nav>
  );
}
