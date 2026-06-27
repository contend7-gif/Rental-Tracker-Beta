import { useMemo } from "react";

export function useAppLookupMaps({ assets, leases, loans, transactions, vendors, workOrders }) {
  const assetById = useMemo(() => Object.fromEntries(assets.map((asset) => [asset.id, asset])), [assets]);
  const leaseById = useMemo(() => Object.fromEntries(leases.map((lease) => [lease.id, lease])), [leases]);
  const loanById = useMemo(() => Object.fromEntries(loans.map((loan) => [loan.id, loan])), [loans]);
  const transactionById = useMemo(() => Object.fromEntries(transactions.map((txn) => [txn.id, txn])), [transactions]);
  const vendorById = useMemo(() => Object.fromEntries(vendors.map((vendor) => [vendor.id, vendor])), [vendors]);
  const workOrderById = useMemo(() => Object.fromEntries(workOrders.map((workOrder) => [workOrder.id, workOrder])), [workOrders]);

  return {
    assetById,
    leaseById,
    loanById,
    transactionById,
    vendorById,
    workOrderById,
  };
}
