import type { DocumentItem, Property, Transaction, Unit, Vendor } from "../models.ts";
import type { DesktopCompanionApi } from "../types/desktop.d.ts";
import type { DocumentImportDraft } from "./documentImportDraft.ts";

export type SilentOptions = { silent?: boolean };

export type UnlinkOptions = SilentOptions & { relatedTransactionId?: string };

export type SaveImportedDocumentOptions = {
  reviewUtilitySection?: unknown;
  createUtilitySectionTransactions?: boolean;
  reviewExpenseDraft?: boolean;
  reviewWorkOrderDraft?: boolean;
};

export type ExpenseDraftOptions = { linkMode?: string };

export type OcrFieldCorrections = {
  vendorName?: unknown;
  totalAmount?: unknown;
  servicePeriodStart?: unknown;
  servicePeriodEnd?: unknown;
  unit?: unknown;
};

export type DocumentWorkspaceActions = {
  [action: string]: any;
  updateDocument: (id: string, update: Partial<DocumentItem>) => void;
  addDocument: (document: DocumentItem) => void;
  addTransaction: (transaction: unknown) => void;
  addWorkOrder: (workOrder: unknown) => void;
};

export type DocumentWorkspaceControllerDependencies = {
  [dependency: string]: any;
  actions: DocumentWorkspaceActions;
  automaticDocumentOcrAvailable: boolean;
  documentImportDraft: DocumentImportDraft;
  documentImportOcrRequestIdRef: { current: number };
  documentImportInputRef: { current: HTMLInputElement | null };
  properties: Array<Pick<Property, "id" | "name" | "address">>;
  documents: DocumentItem[];
  desktopCompanionApi?: DesktopCompanionApi | null;
  propertyFilter: string;
  unitFilter: string;
  transactions: Transaction[];
  units: Array<Pick<Unit, "propertyId" | "name">>;
  vendors?: Vendor[];
  visibleAutomaticOcrDocuments: DocumentItem[];
  visibleDocuments: DocumentItem[];
  visibleDocumentsMissingIndex: DocumentItem[];
};
