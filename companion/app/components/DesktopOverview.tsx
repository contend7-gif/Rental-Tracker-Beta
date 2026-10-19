"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizeDesktopSnapshot, type DesktopSnapshot } from '@/lib/desktop-snapshot';
const money = (v: number | null) => v === null ? 'Not recorded' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);
const displayDate = (v: string) => v ? new Date(`${v}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not recorded';
export function DesktopOverview({ active }: { active: boolean }) {
  const [snapshot, setSnapshot] = useState<DesktopSnapshot | null>(null);
  const [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const [propertyId, setPropertyId] = useState('all'), [unit, setUnit] = useState('all');
  const [mode, setMode] = useState<'properties'|'transactions'|'mortgages'>('properties');
  const [search, setSearch] = useState(''), [type, setType] = useState('all');
  const [page, setPage] = useState(1);
  const inFlight = useRef(false);
  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    try {
      const response = await fetch('/api/snapshot', { cache: 'no-store' });
      const body = await response.json() as { snapshot?: unknown; error?: string };
      if (!response.ok) throw new Error(body.error || 'Desktop snapshot could not refresh.');
      setSnapshot(body.snapshot ? normalizeDesktopSnapshot(body.snapshot) : null); setError('');
    } catch(error) { setError(error instanceof Error ? error.message : 'Desktop snapshot could not refresh.'); }
    finally { inFlight.current = false; setLoading(false); }
  }, []);
  useEffect(() => { if (!active) return; void load(); const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 60_000); return () => window.clearInterval(timer); }, [active, load]);
  useEffect(() => { setPage(1); }, [propertyId, unit, search, type]);
  const scoped = <T extends { propertyId: string; unit?: string }>(rows: T[]) => rows.filter(r => (propertyId === 'all' || r.propertyId === propertyId) && (unit === 'all' || !r.unit || r.unit === unit));
  const propertyName = (id: string) => snapshot?.properties.find(p => p.id === id)?.name || 'Property';
  const stale = snapshot && Date.now() - Date.parse(snapshot.generatedAt) > 24*60*60*1000;
  const properties = snapshot?.properties.filter(p => propertyId === 'all' || p.id === propertyId) || [];
  const leases = scoped(snapshot?.leases || []).filter(lease => lease.status !== 'Ended'), work = scoped(snapshot?.workOrders || []), loans = scoped(snapshot?.loans || []);
  const tx = scoped(snapshot?.transactions || []).filter(t => (type === 'all' || t.type === type) && `${t.description} ${t.vendor} ${t.category}`.toLowerCase().includes(search.toLowerCase()));
  const events = [...leases.filter(l => l.endDate).map(l => ({ id:`lease-${l.id}`, propertyId:l.propertyId, date:l.endDate, title:`Lease ending · ${l.tenantName || l.unit}` })), ...work.filter(w => w.dueDate).map(w => ({ id:`work-${w.id}`, propertyId:w.propertyId, date:w.dueDate, title:w.title })), ...loans.filter(l => l.nextPayment).map(l => ({ id:`loan-${l.id}`, propertyId:l.propertyId, date:l.nextPayment, title:`Mortgage payment · ${l.lender}` }))].filter(e => e.date >= (snapshot?.asOfDate || '')).sort((a,b) => a.date.localeCompare(b.date)).slice(0,8);
  return <section hidden={!active} className="overview-panel" aria-labelledby="desktop-overview-title">
    <div className="section-heading"><div><p className="step-label">DESKTOP → PHONE</p><h2 id="desktop-overview-title">Your rental overview</h2></div><button type="button" className="secondary-button" onClick={() => void load()} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button></div>
    <p className="snapshot-stamp">{snapshot ? `Updated from desktop ${new Date(snapshot.generatedAt).toLocaleString()}` : 'Waiting for your first desktop snapshot'} · Read only</p>
    {error && <p className="alert error" role="alert">{error} {snapshot ? 'The last loaded snapshot is still shown.' : ''}</p>}
    {stale && <p className="alert" role="status">This snapshot is more than a day old. Open the desktop app to update it; records below reflect the timestamp above.</p>}
    {!snapshot && !loading && !error && <div className="snapshot-empty"><h3>Bring your desktop records along</h3><p>In desktop Settings → Admin &amp; Tools → Mobile companion, turn on Read-only phone overview. Pairing stays the same. Your laptop sends a snapshot while the app is open.</p></div>}
    {snapshot && <>
      <div className="snapshot-filters"><label>Property<select value={propertyId} onChange={event => { setPropertyId(event.target.value); setUnit('all'); }}><option value="all">All properties</option>{snapshot.properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Unit<select value={unit} disabled={propertyId === 'all'} onChange={event => setUnit(event.target.value)}><option value="all">All units</option><option value="Shared">Shared</option>{snapshot.units.filter(u => u.propertyId === propertyId).map(u => <option key={u.id} value={u.name}>{u.name}</option>)}</select></label></div>
      <div className="snapshot-metrics"><div><strong>{leases.length}</strong><span>Lease records</span></div><div><strong>{work.length}</strong><span>Open work orders</span></div><div><strong>{loans.length}</strong><span>Loans</span></div></div>
      <div className="snapshot-modes" role="group" aria-label="Overview view">{(['properties','transactions','mortgages'] as const).map(tab => <button type="button" key={tab} aria-pressed={mode === tab} onClick={() => setMode(tab)}>{tab === 'properties' ? 'Properties' : tab === 'transactions' ? 'Transactions' : 'Mortgages'}</button>)}</div>
      {mode === 'properties' && <>
        {properties.length === 0 && <p>No properties in this snapshot.</p>}
        {properties.map(p => <details className="snapshot-record" key={p.id}><summary><strong>{p.name}</strong><span>{p.address || 'Address not recorded'}</span></summary>
          {snapshot.units.filter(u => u.propertyId === p.id && (unit === 'all' || u.name === unit)).map(u => <div className="snapshot-line" key={u.id}><strong>{u.name}</strong><span>{u.status}</span></div>)}
          <h3>Leases</h3>{leases.filter(l => l.propertyId === p.id).length === 0 && <p>No ongoing lease records in this scope.</p>}{leases.filter(l => l.propertyId === p.id).map(l => <div className="snapshot-detail" key={l.id}><strong>{l.tenantName || 'Tenant not recorded'} · {l.unit}</strong><p>{displayDate(l.startDate)} – {displayDate(l.endDate)} · {l.status}</p><p>Monthly rent: {money(l.monthlyRent)} · Billing: {l.billingCadence.replaceAll('_',' ')}</p></div>)}
          <h3>Maintenance</h3>{work.filter(w => w.propertyId === p.id).length === 0 && <p>No open work orders in this scope.</p>}{work.filter(w => w.propertyId === p.id).map(w => <div className="snapshot-detail" key={w.id}><strong>{w.title}</strong><p>{w.unit} · {w.priority} · {w.status}</p><p>Due: {displayDate(w.dueDate)}</p></div>)}
        </details>)}
        <div className="snapshot-card"><h3>Upcoming dates in this snapshot</h3>{events.length === 0 ? <p>No upcoming recorded dates.</p> : events.map(e => <div className="snapshot-detail" key={e.id}><strong>{e.title}</strong><p>{displayDate(e.date)} · {propertyName(e.propertyId)}</p></div>)}</div>
      </>}
      {mode === 'transactions' && <>
        <p className="snapshot-help">Latest {snapshot.transactions.length} of {snapshot.transactionCount} recorded transactions across the portfolio. Filters search this snapshot; use the desktop for full history.</p>
        <div className="snapshot-filters"><label>Find a transaction<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Vendor, description, or category" /></label><label>Type<select value={type} onChange={e => setType(e.target.value)}><option value="all">All types</option>{Array.from(new Set(snapshot.transactions.map(t => t.type))).map(t => <option key={t} value={t}>{t}</option>)}</select></label></div>
        {tx.length === 0 && <p>No transactions match this scope and search.</p>}
        {tx.slice(0,page*20).map(t => <details className={`snapshot-record transaction ${t.type.toLowerCase() === 'income' ? 'income' : ''}`} key={t.id}><summary><div><strong>{t.vendor || t.description || t.category}</strong><span>{displayDate(t.date)} · {t.category}</span></div><b>{money(t.amount)}</b></summary><p>{propertyName(t.propertyId)} · {t.unit} · {t.type}</p><p>{t.description}</p><p>{t.reconciled ? 'Reconciled on desktop' : 'Not marked reconciled'}</p></details>)}
        {tx.length > page*20 && <button type="button" className="secondary-button" onClick={() => setPage(p => p+1)}>Show more transactions</button>}
      </>}
      {mode === 'mortgages' && <>
        <p className="snapshot-help">Balances and schedules are recorded desktop values. This is not a lender statement or payoff quote.{unit !== 'all' ? ' Loans apply to the whole property.' : ''}</p>
        {loans.length === 0 && <p>No loans recorded for this property scope.</p>}
        {loans.map(l => <details className="snapshot-record mortgage" key={l.id}>
          <summary><strong>{l.lender || 'Lender not recorded'}</strong><span>{propertyName(l.propertyId)} · {l.loanType}</span><b>{money(l.currentBalance)} balance</b></summary>
          <dl className="snapshot-values">
            <div><dt>Rate</dt><dd>{l.rate === null ? 'Not recorded' : `${l.rate}%`}</dd></div>
            <div><dt>Scheduled payment</dt><dd>{money(l.scheduledPI !== null && l.scheduledEscrow !== null && l.scheduledMortgageInsurance !== null ? l.scheduledPI + l.scheduledEscrow + l.scheduledMortgageInsurance : null)}</dd></div>
            <div><dt>Principal &amp; interest</dt><dd>{money(l.scheduledPI)}</dd></div>
            <div><dt>Escrow</dt><dd>{money(l.scheduledEscrow)}</dd></div>
            <div><dt>Mortgage insurance</dt><dd>{money(l.scheduledMortgageInsurance)}</dd></div>
            <div><dt>Extra principal</dt><dd>{money(l.defaultExtraPrincipal)}</dd></div>
            <div><dt>Next recorded payment</dt><dd>{displayDate(l.nextPayment)}</dd></div>
            <div><dt>Latest recorded payment</dt><dd>{displayDate(l.lastPaymentDate)} · {money(l.lastPaymentAmount)}</dd></div>
            <div><dt>Estimated payoff</dt><dd>{l.projectedPayoffDate ? displayDate(l.projectedPayoffDate) : 'Not available'}</dd></div>
          </dl>
          {l.projectedPayoffDate && <p>Estimate uses the desktop planning calculation with the recorded balance, current rate, scheduled principal and interest, and extra principal held constant. Escrow and insurance do not reduce the loan balance.</p>}
        </details>)}
      </>}
    </>}
  </section>;
}
