export type WorkspaceFocusSource = "maintenance" | "document" | "recurring";

export type WorkspaceFocusRequest = {
  source: WorkspaceFocusSource;
  recordId: string;
  requestId: string;
};

let requestSequence = 0;

export function createWorkspaceFocusRequest(source: WorkspaceFocusSource, recordId: string): WorkspaceFocusRequest {
  requestSequence += 1;
  return {
    source,
    recordId: String(recordId || ""),
    requestId: `${Date.now()}-${requestSequence}`,
  };
}

export function workspaceFocusDomId(scope: string, recordId: string) {
  const safeScope = String(scope || "record").replace(/[^a-zA-Z0-9_-]+/g, "-");
  const safeRecordId = String(recordId || "unknown").replace(/[^a-zA-Z0-9_-]+/g, "-");
  return `workspace-focus-${safeScope}-${safeRecordId}`;
}

