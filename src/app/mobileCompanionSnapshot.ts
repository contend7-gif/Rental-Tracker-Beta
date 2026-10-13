import { normalizeDesktopSnapshot } from '../../companion/lib/desktop-snapshot.ts';
import type { Property, Unit, Lease, Transaction, Loan, LoanPayment, WorkOrder } from '../models.ts';
import { toLocalIsoDate } from '../lib/localDate.ts';
import { buildPlanningDebtPayoffAnalysis } from '../domain/planning/financing.ts';
export function buildMobileCompanionSnapshot({ properties, units, leases, transactions, loans, loanPayments, workOrders, generatedAt = new Date().toISOString(), asOfDate = toLocalIsoDate(new Date(generatedAt)) }: {
  properties: Property[]; units: Unit[]; leases: Lease[]; transactions: Transaction[]; loans: Loan[]; loanPayments: LoanPayment[]; workOrders: WorkOrder[]; generatedAt?: string; asOfDate?: string;
}) {
  const activeProperties = properties.filter(p => !p.archivedAt);
  const propertyIds = new Set(activeProperties.map(p => p.id));
  const recordedTransactions = transactions.filter(t => t.status !== 'voided' && propertyIds.has(t.propertyId));
  return normalizeDesktopSnapshot({
    version: 1, generatedAt, asOfDate,
    properties: activeProperties.map(p => ({ id: p.id, name: p.name, address: p.address })),
    units: units.map(u => ({ id: u.id, propertyId: u.propertyId, name: u.name, status: u.status })),
    leases: leases.filter(l => l.status !== 'Ended').map(l => ({ id: l.id, propertyId: l.propertyId, unit: l.unit, tenantName: l.tenantName, startDate: l.startDate, endDate: l.actualEndDate || l.endDate, monthlyRent: l.monthlyRent, status: l.status, billingCadence: l.billingCadence || 'monthly' })),
    transactions: [...recordedTransactions].sort((a,b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id))).slice(0,200).map(t => ({ id: t.id, propertyId: t.propertyId, unit: t.unit, date: t.date, type: t.type, category: t.category, description: t.description, vendor: t.vendor, amount: t.amount, reconciled: t.reconciled === true })),
    transactionCount: recordedTransactions.length,
    loans: loans.map(l => {
      const last = loanPayments.filter(p => String(p.loanId) === String(l.id) && p.paymentDate <= asOfDate).sort((a,b) => b.paymentDate.localeCompare(a.paymentDate))[0];
      const hasPayoffInputs = [l.currentBalance,l.rate,l.scheduledPI,l.defaultExtraPrincipal].every(value => value !== undefined && value !== null && Number.isFinite(Number(value))) && l.currentBalance > 0 && l.rate >= 0 && l.scheduledPI + l.defaultExtraPrincipal > l.currentBalance * l.rate / 1200;
      const payoff = hasPayoffInputs ? buildPlanningDebtPayoffAnalysis({ today: asOfDate, loans: [l] }) : null;
      return { id: l.id, propertyId: l.propertyId, lender: l.lender, loanType: l.loanType, currentBalance: l.currentBalance, rate: l.rate, scheduledPI: l.scheduledPI, scheduledEscrow: l.scheduledEscrow, scheduledMortgageInsurance: l.scheduledMortgageInsurance, defaultExtraPrincipal: l.defaultExtraPrincipal, nextPayment: l.nextPayment, lastPaymentDate: last?.paymentDate, lastPaymentAmount: last?.totalPayment, projectedPayoffDate: payoff && payoff.currentMonthsToPayoff < 720 ? payoff.projectedPayoffDate : '' };
    }),
    workOrders: workOrders.filter(w => !['Completed','Closed','Canceled'].includes(w.status)).map(w => ({ id: w.id, propertyId: w.propertyId, unit: w.unit, title: w.title, priority: w.priority, status: w.status, reportedOn: w.reportedOn, dueDate: w.dueDate })),
  });
}
