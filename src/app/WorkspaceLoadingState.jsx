import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function WorkspaceLoadingState() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Loading workspace</CardTitle>
        <CardDescription>Pulling in the selected screen.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-4 text-sm text-slate-600">
          One moment while this workspace loads.
        </div>
      </CardContent>
    </Card>
  );
}
