import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeDesktopSnapshot } from '../lib/desktop-snapshot.ts';
const base = { version: 1, generatedAt: '2026-10-12T12:00:00Z', properties: [{ id:'p', name:'Example', address:'Example address', ownerEmail:'private-owner', photos:[{ dataUrl:'private-file' }] }] };
test('snapshot strips private fields, keeps zero values, and rejects unrelated property rows', () => {
  const saved = normalizeDesktopSnapshot({ ...base, apiKey:'private-key', transactions:[{ id:'t', propertyId:'p', amount:0, notes:'private-note', receiptName:'private-file' },{ id:'unrelated', propertyId:'other', amount:10 }], loans:[{ id:'l', propertyId:'p', rate:0, currentBalance:0, accountNumber:'private-account' }] });
  assert.equal(saved.transactions.length,1); assert.equal(saved.transactions[0].amount,0); assert.equal(saved.loans[0].rate,0);
  assert.equal(JSON.stringify(saved).includes('private-'),false);
  assert.equal(saved.loans[0].scheduledPI,null);
});
test('snapshot bounds collections and rejects unsupported schemas and invalid dates', () => {
  const saved = normalizeDesktopSnapshot({ ...base, transactionCount:250, transactions:Array.from({length:250},(_,i)=>({id:String(i),propertyId:'p',date:'2026-02-30',amount:Infinity})) });
  assert.equal(saved.transactions.length,200); assert.equal(saved.transactionCount,250); assert.equal(saved.transactions[0].date,''); assert.equal(saved.transactions[0].amount,null);
  assert.throws(()=>normalizeDesktopSnapshot({...base,version:2})); assert.throws(()=>normalizeDesktopSnapshot({...base,generatedAt:'yesterday'}));
});
