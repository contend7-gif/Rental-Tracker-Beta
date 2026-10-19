// Shared, explicit cloud contract. Never spread desktop records into a snapshot.
import { cleanTurnover, type TurnoverChecklist } from './turnover-contract.ts';
export type SnapshotProperty = { id: string; name: string; address: string };
export type SnapshotUnit = { id: string; propertyId: string; name: string; status: string };
export type SnapshotLease = { id: string; propertyId: string; unit: string; tenantName: string; startDate: string; endDate: string; monthlyRent: number | null; status: string; billingCadence: string; turnover?: TurnoverChecklist | null };
export type SnapshotTransaction = { id: string; propertyId: string; unit: string; date: string; type: string; category: string; description: string; vendor: string; amount: number | null; reconciled: boolean };
export type SnapshotLoan = { id: string; propertyId: string; lender: string; loanType: string; currentBalance: number | null; rate: number | null; scheduledPI: number | null; scheduledEscrow: number | null; scheduledMortgageInsurance: number | null; defaultExtraPrincipal: number | null; nextPayment: string; lastPaymentDate: string; lastPaymentAmount: number | null; projectedPayoffDate: string };
export type SnapshotWorkOrder = { id: string; propertyId: string; unit: string; title: string; priority: string; status: string; reportedOn: string; dueDate: string };
export type DesktopSnapshot = { version: 1; generatedAt: string; asOfDate: string; properties: SnapshotProperty[]; units: SnapshotUnit[]; leases: SnapshotLease[]; transactions: SnapshotTransaction[]; loans: SnapshotLoan[]; workOrders: SnapshotWorkOrder[]; transactionCount: number; turnoverSync?: boolean };
const record = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const text = (v: unknown, limit = 160) => typeof v === 'string' || typeof v === 'number' ? String(v).trim().slice(0, limit) : '';
const amount = (v: unknown) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)) && Math.abs(Number(v)) <= 1e12 ? Number(v) : null;
const date = (v: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(text(v)) && Number.isFinite(Date.parse(text(v))) && new Date(text(v)).toISOString().slice(0,10) === text(v) ? text(v) : '';
function rows<T>(v: unknown, limit: number, map: (r: Record<string, unknown>) => T & { id: string }): T[] {
  const seen = new Set<string>();
  return (Array.isArray(v) ? v.slice(0, limit) : []).map(record).map(map).filter(r => r.id && !seen.has(r.id) && Boolean(seen.add(r.id)));
}
export function normalizeDesktopSnapshot(value: unknown): DesktopSnapshot {
  const v = record(value);
  if (v.version !== 1 || !/^\d{4}-\d{2}-\d{2}T/.test(text(v.generatedAt)) || !Number.isFinite(Date.parse(text(v.generatedAt)))) throw new Error('Unsupported or invalid desktop snapshot.');
  const properties = rows(v.properties, 100, r => ({ id: text(r.id), name: text(r.name), address: text(r.address, 240) }));
  const propertyIds = new Set(properties.map(p => p.id));
  const belongs = <T extends { propertyId: string }>(items: T[]) => items.filter(r => propertyIds.has(r.propertyId));
  const transactions = belongs(rows(v.transactions, 200, r => ({ id: text(r.id), propertyId: text(r.propertyId), unit: text(r.unit, 80), date: date(r.date), type: text(r.type, 30), category: text(r.category, 80), description: text(r.description, 240), vendor: text(r.vendor), amount: amount(r.amount), reconciled: r.reconciled === true })));
  return {
    turnoverSync: v.turnoverSync === true, version: 1, generatedAt: new Date(text(v.generatedAt)).toISOString(), asOfDate: date(v.asOfDate) || new Date(text(v.generatedAt)).toISOString().slice(0,10), properties,
    units: belongs(rows(v.units, 500, r => ({ id: text(r.id), propertyId: text(r.propertyId), name: text(r.name, 80), status: text(r.status, 40) }))),
    leases: belongs(rows(v.leases, 500, r => ({ id: text(r.id), propertyId: text(r.propertyId), unit: text(r.unit, 80), tenantName: text(r.tenantName), startDate: date(r.startDate), endDate: date(r.endDate), monthlyRent: amount(r.monthlyRent), status: text(r.status, 40), billingCadence: text(r.billingCadence, 40), ...(v.turnoverSync === true ? { turnover: cleanTurnover(r.turnover) } : {}) }))),
    transactions,
    loans: belongs(rows(v.loans, 100, r => ({ id: text(r.id), propertyId: text(r.propertyId), lender: text(r.lender), loanType: text(r.loanType, 40), currentBalance: amount(r.currentBalance), rate: amount(r.rate), scheduledPI: amount(r.scheduledPI), scheduledEscrow: amount(r.scheduledEscrow), scheduledMortgageInsurance: amount(r.scheduledMortgageInsurance), defaultExtraPrincipal: amount(r.defaultExtraPrincipal), nextPayment: date(r.nextPayment), lastPaymentDate: date(r.lastPaymentDate), lastPaymentAmount: amount(r.lastPaymentAmount), projectedPayoffDate: date(r.projectedPayoffDate) }))),
    workOrders: belongs(rows(v.workOrders, 500, r => ({ id: text(r.id), propertyId: text(r.propertyId), unit: text(r.unit, 80), title: text(r.title, 240), priority: text(r.priority, 40), status: text(r.status, 40), reportedOn: date(r.reportedOn), dueDate: date(r.dueDate) }))),
    transactionCount: Math.max(transactions.length, Math.floor(Math.max(0, amount(v.transactionCount) || 0))),
  };
}
