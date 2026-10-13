import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMobileCompanionSnapshot } from './mobileCompanionSnapshot.ts';
test('payoff estimates require amortizing inputs and payment dates follow the desktop local day', () => {
  const snapshot = buildMobileCompanionSnapshot({ properties:[{id:'p',name:'Example'}], units:[], leases:[], transactions:[], workOrders:[],
    generatedAt:'2026-10-13T01:00:00Z', asOfDate:'2026-10-12',
    loans:[{id:'zero',propertyId:'p',currentBalance:1200,rate:0,scheduledPI:100,defaultExtraPrincipal:0},{id:'interest-only',propertyId:'p',currentBalance:12000,rate:12,scheduledPI:120,defaultExtraPrincipal:0}],
    loanPayments:[{loanId:'zero',paymentDate:'2026-10-12',totalPayment:100},{loanId:'zero',paymentDate:'2026-10-13',totalPayment:200}],
  } as never);
  assert.equal(snapshot.loans[0].projectedPayoffDate,'2027-10-12');
  assert.equal(snapshot.loans[1].projectedPayoffDate,'');
  assert.equal(snapshot.loans[0].lastPaymentAmount,100);
});
test('desktop snapshot sends only active-property records, recent transactions, and latest recorded mortgage payment', () => {
  const snapshot = buildMobileCompanionSnapshot({
    generatedAt:'2026-10-12T12:00:00Z',
    properties:[{id:'p',name:'Example',address:'Example address',ownerPhone:'private-phone'},{id:'archived',name:'Archived',archivedAt:'2026-01-01'}],
    units:[], leases:[], workOrders:[{id:'w',propertyId:'p',title:'Example repair',status:'Closed'}],
    transactions:[{id:'old',propertyId:'p',date:'2026-09-01',amount:0,notes:'private-note'},{id:'new',propertyId:'p',date:'2026-10-01',amount:20},{id:'void',propertyId:'p',date:'2026-10-12',status:'voided'},{id:'archived-t',propertyId:'archived',date:'2026-10-12'}],
    loans:[{id:'l',propertyId:'p',lender:'Example lender',rate:6,currentBalance:100000,scheduledPI:700}],
    loanPayments:[{loanId:'l',paymentDate:'2026-09-01',totalPayment:900},{loanId:'l',paymentDate:'2026-10-01',totalPayment:910},{loanId:'l',paymentDate:'2026-11-01',totalPayment:1000}],
  } as never);
  assert.deepEqual(snapshot.transactions.map(t=>t.id),['new','old']); assert.equal(snapshot.transactionCount,2);
  assert.equal(snapshot.loans[0].lastPaymentDate,'2026-10-01'); assert.equal(snapshot.loans[0].lastPaymentAmount,910);
  assert.equal(snapshot.workOrders.length,0); assert.equal(JSON.stringify(snapshot).includes('private-'),false);
});
