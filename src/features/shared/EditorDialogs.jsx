import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { field } from "./uiHelpers.jsx";
import { selectableProperties } from "../../domain/propertyLifecycle.js";

export function PropertyQuickAddDialog({
  dialogContentLgClass,
  formatUsPhone,
  open,
  ownerContactDefaults,
  properties,
  propertyDraft,
  saveProperty,
  setPropertyDraft,
  setPropertyQuickAddOpen,
}) {
  return (
    <Dialog open={open} onOpenChange={setPropertyQuickAddOpen}>
      <DialogContent className={dialogContentLgClass}>
        <DialogHeader>
          <DialogTitle>Add Property</DialogTitle>
        </DialogHeader>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {field("Name", <Input value={propertyDraft.name} onChange={(e) => setPropertyDraft({ ...propertyDraft, name: e.target.value })} />)}
          {field("Address", <Input value={propertyDraft.address} onChange={(e) => setPropertyDraft({ ...propertyDraft, address: e.target.value })} />)}
          {field("Owner name (optional)", <Input value={propertyDraft.ownerName} placeholder={ownerContactDefaults.ownerName || "Uses Settings default"} onChange={(e) => setPropertyDraft({ ...propertyDraft, ownerName: e.target.value })} />)}
          {field("Owner email (optional)", <Input value={propertyDraft.ownerEmail} placeholder={ownerContactDefaults.ownerEmail || "Uses Settings default"} onChange={(e) => setPropertyDraft({ ...propertyDraft, ownerEmail: e.target.value })} />)}
          {field("Owner phone (optional)", <Input value={propertyDraft.ownerPhone} placeholder={ownerContactDefaults.ownerPhone || "Uses Settings default"} onChange={(e) => setPropertyDraft({ ...propertyDraft, ownerPhone: formatUsPhone(e.target.value) })} />)}
          <div className="md:col-span-2 text-xs text-slate-500">Leave owner fields blank to use the global owner contact from Settings.</div>
          {field(
            "Type",
            <Select value={propertyDraft.type} onValueChange={(value) => setPropertyDraft({ ...propertyDraft, type: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Single Family">Single Family</SelectItem>
                <SelectItem value="Duplex">Duplex</SelectItem>
                <SelectItem value="Triplex">Triplex</SelectItem>
                <SelectItem value="Fourplex">Fourplex</SelectItem>
              </SelectContent>
            </Select>,
          )}
          {field("Purchased on", <Input type="date" value={propertyDraft.purchasedOn} onChange={(e) => setPropertyDraft({ ...propertyDraft, purchasedOn: e.target.value })} />)}
          {field("Purchase price (optional)", <Input type="number" value={propertyDraft.purchasePrice} onChange={(e) => setPropertyDraft({ ...propertyDraft, purchasePrice: e.target.value })} />)}
          {field("Land value (optional)", <Input type="number" value={propertyDraft.landValue} onChange={(e) => setPropertyDraft({ ...propertyDraft, landValue: e.target.value })} />)}
          {field("Manual value basis (optional)", <Input type="number" value={propertyDraft.currentValue} onChange={(e) => setPropertyDraft({ ...propertyDraft, currentValue: e.target.value })} />, { hint: "Fallback support used when no valuation history exists." })}
          <div className="md:col-span-2 rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">If purchase and land values are entered, a Residential Building asset is auto-created with basis = purchase price - land value (27.5-year life).</div>
          <div className="md:col-span-2">
            <Label>Units (comma or newline separated)</Label>
            <textarea className="mt-1 h-28 w-full rounded-md border border-slate-200 p-2 text-sm" value={propertyDraft.unitsText} onChange={(e) => setPropertyDraft({ ...propertyDraft, unitsText: e.target.value })} />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Button onClick={saveProperty}>Save property</Button>
          <Button variant="secondary" onClick={() => setPropertyQuickAddOpen(false)}>Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DashboardQuickAddDialog({
  categories,
  categoriesForFormType,
  createBlankForm,
  dialogContentLgClass,
  form,
  incomeCategoriesForForm,
  open,
  pendingTxnAttachment,
  properties,
  saveTransaction,
  setDashboardQuickAddOpen,
  setForm,
  setPendingTxnAttachment,
  setRentAmountTouched,
  txnAttachmentInputRef,
  units,
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setDashboardQuickAddOpen(isOpen);
        if (!isOpen) {
          setForm(createBlankForm(form.propertyId, form.unit || "Shared"));
          setPendingTxnAttachment(null);
          if (txnAttachmentInputRef.current) txnAttachmentInputRef.current.value = "";
          setRentAmountTouched(false);
        }
      }}
    >
      <DialogContent className={dialogContentLgClass}>
        <DialogHeader>
          <DialogTitle>Quick Add Transaction</DialogTitle>
        </DialogHeader>
        {properties.length === 0 && (
          <div className="mt-2 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Add your first property before adding transactions.
          </div>
        )}
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {field("Date", <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />)}
          {field(
            "Property",
            <Select value={form.propertyId} onValueChange={(v) => setForm({ ...form, propertyId: v, unit: "Shared" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {properties.map((property) => <SelectItem key={property.id} value={property.id}>{property.name}</SelectItem>)}
              </SelectContent>
            </Select>,
          )}
          {field(
            "Unit",
            <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Shared">Shared</SelectItem>
                {units.filter((unit) => unit.propertyId === form.propertyId).map((unit) => <SelectItem key={unit.id} value={unit.name}>{unit.name}</SelectItem>)}
              </SelectContent>
            </Select>,
          )}
          {field(
            "Type",
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v, category: v === "Income" ? incomeCategoriesForForm[0] : categories[v][0] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.keys(categories).map((key) => <SelectItem key={key} value={key}>{key}</SelectItem>)}
              </SelectContent>
            </Select>,
          )}
          {field(
            "Category",
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {categoriesForFormType.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}
              </SelectContent>
            </Select>,
          )}
          {field("Amount", <Input type="number" value={form.amount} onChange={(e) => { setRentAmountTouched(true); setForm({ ...form, amount: e.target.value }); }} />)}
          <div className="md:col-span-2">
            {field("Description", <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />)}
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Button onClick={() => { saveTransaction(true); setDashboardQuickAddOpen(false); }} disabled={properties.length === 0}>Save</Button>
          <Button variant="secondary" onClick={() => setDashboardQuickAddOpen(false)}>Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function LoanEditorDialog({
  clearLoanDraft,
  dialogContentLgClass,
  editingLoanId,
  loanDraft,
  loanEditorOpen,
  properties,
  saveLoan,
  setLoanDraft,
  setLoanEditorOpen,
}) {
  const propertyOptions = selectableProperties(properties, loanDraft.propertyId);
  return (
    <Dialog
      open={loanEditorOpen}
      onOpenChange={(isOpen) => {
        setLoanEditorOpen(isOpen);
        if (!isOpen) clearLoanDraft(loanDraft.propertyId);
      }}
    >
      <DialogContent className={dialogContentLgClass}>
        <DialogHeader>
          <DialogTitle>{editingLoanId ? "Edit Loan" : "Add Loan"}</DialogTitle>
        </DialogHeader>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {field(
            "Property",
            <Select value={loanDraft.propertyId} onValueChange={(value) => setLoanDraft({ ...loanDraft, propertyId: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {propertyOptions.map((property) => <SelectItem key={property.id} value={property.id}>{property.name}</SelectItem>)}
              </SelectContent>
            </Select>,
          )}
          {field("Lender", <Input value={loanDraft.lender} onChange={(e) => setLoanDraft({ ...loanDraft, lender: e.target.value })} />)}
          {field(
            "Loan type",
            <Select value={loanDraft.loanType} onValueChange={(value) => setLoanDraft({ ...loanDraft, loanType: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Primary Mortgage">Primary Mortgage</SelectItem>
                <SelectItem value="Second Mortgage">Second Mortgage</SelectItem>
                <SelectItem value="HELOC">HELOC</SelectItem>
                <SelectItem value="Down Payment Loan">Down Payment Loan</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>,
          )}
          {field("Lien position", <Input type="number" value={loanDraft.lienPosition} onChange={(e) => setLoanDraft({ ...loanDraft, lienPosition: e.target.value })} />)}
          {field("Originated on", <Input type="date" value={loanDraft.originatedOn} onChange={(e) => setLoanDraft({ ...loanDraft, originatedOn: e.target.value })} />)}
          {field("Interest rate (%)", <Input type="number" step="0.01" value={loanDraft.rate} onChange={(e) => setLoanDraft({ ...loanDraft, rate: e.target.value })} />)}
          {field("Original balance", <Input type="number" value={loanDraft.originalBalance} onChange={(e) => setLoanDraft({ ...loanDraft, originalBalance: e.target.value })} />)}
          {field("Current balance", <Input type="number" value={loanDraft.currentBalance} onChange={(e) => setLoanDraft({ ...loanDraft, currentBalance: e.target.value })} />)}
          {field("Scheduled P&I", <Input type="number" value={loanDraft.scheduledPI} onChange={(e) => setLoanDraft({ ...loanDraft, scheduledPI: e.target.value })} />)}
          {field("Scheduled escrow", <Input type="number" value={loanDraft.scheduledEscrow} onChange={(e) => setLoanDraft({ ...loanDraft, scheduledEscrow: e.target.value })} />)}
          {field("Mortgage insurance", <Input type="number" value={loanDraft.scheduledMortgageInsurance} onChange={(e) => setLoanDraft({ ...loanDraft, scheduledMortgageInsurance: e.target.value })} />)}
          {field("Default extra principal", <Input type="number" value={loanDraft.defaultExtraPrincipal} onChange={(e) => setLoanDraft({ ...loanDraft, defaultExtraPrincipal: e.target.value })} />)}
          {field("Next payment", <Input type="date" value={loanDraft.nextPayment} onChange={(e) => setLoanDraft({ ...loanDraft, nextPayment: e.target.value })} />)}
        </div>
        <div className="mt-3 flex gap-2">
          <Button onClick={saveLoan}>{editingLoanId ? "Update loan" : "Add loan"}</Button>
          <Button variant="secondary" onClick={() => clearLoanDraft(loanDraft.propertyId)}>Clear</Button>
          <Button variant="secondary" onClick={() => { setLoanEditorOpen(false); clearLoanDraft(loanDraft.propertyId); }}>Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
