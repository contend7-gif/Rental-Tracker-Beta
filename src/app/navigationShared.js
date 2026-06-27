import {
  Archive,
  ArrowUpRight,
  Building2,
  CalendarDays,
  ClipboardCheck,
  FolderOpen,
  Home,
  Landmark,
  PlusCircle,
  Receipt,
  Settings,
  Shield,
  Table2,
  Wallet,
} from "lucide-react";

export const primaryNavItems = [
  ["dashboard", "Dashboard", Home],
  ["quickAdd", "Add Transaction", PlusCircle],
  ["ledger", "Ledger", Table2],
  ["documents", "Documents", FolderOpen],
  ["maintenance", "Maintenance", Archive],
  ["leaseHistory", "Leases", CalendarDays],
  ["tax", "Tax Center", Receipt],
  ["review", "Review", ClipboardCheck],
];

export const propertyAccountingNavItems = [
  ["properties", "Properties", Building2],
  ["assets", "Assets", Wallet],
  ["loans", "Loans", Landmark],
  ["planning", "Planning", ArrowUpRight],
];

export const adminNavItems = [
  ["tax", "Tax Center", Receipt],
  ["activity", "Activity Log", Shield],
  ["settings", "Settings", Settings],
];

export const navItems = [
  ...primaryNavItems,
  ...propertyAccountingNavItems,
  ["settings", "Settings", Settings],
];

export const viewDetails = {
  dashboard: { title: "Dashboard", description: "", icon: Home, tone: "border-teal-100 bg-teal-50 text-teal-700" },
  quickAdd: { title: "Add Transaction", description: "New ledger entry.", icon: PlusCircle, tone: "border-emerald-100 bg-emerald-50 text-emerald-700" },
  ledger: { title: "Ledger", description: "Transactions and imports.", icon: Table2, tone: "border-blue-100 bg-blue-50 text-blue-700" },
  review: { title: "Review Center", description: "Open cleanup checks.", icon: ClipboardCheck, tone: "border-amber-100 bg-amber-50 text-amber-700" },
  recurring: { title: "Recurring", description: "Recurring transaction rules.", icon: CalendarDays, tone: "border-violet-100 bg-violet-50 text-violet-700" },
  properties: { title: "Properties", description: "Property, unit, and valuation records.", icon: Building2, tone: "border-cyan-100 bg-cyan-50 text-cyan-700" },
  leaseHistory: { title: "Leases", description: "Lease and occupancy records.", icon: CalendarDays, tone: "border-violet-100 bg-violet-50 text-violet-700" },
  maintenance: { title: "Maintenance", description: "Work orders and vendors.", icon: Archive, tone: "border-orange-100 bg-orange-50 text-orange-700" },
  assets: { title: "Assets", description: "Depreciation asset records.", icon: Wallet, tone: "border-indigo-100 bg-indigo-50 text-indigo-700" },
  loans: { title: "Loans", description: "Debt and payment records.", icon: Landmark, tone: "border-sky-100 bg-sky-50 text-sky-700" },
  planning: { title: "Planning", description: "Forecasts and scenarios.", icon: ArrowUpRight, tone: "border-purple-100 bg-purple-50 text-purple-700" },
  tax: { title: "Tax Center", description: "Schedule E and tax review.", icon: Receipt, tone: "border-emerald-100 bg-emerald-50 text-emerald-700" },
  documents: { title: "Documents", description: "Files and supporting records.", icon: FolderOpen, tone: "border-blue-100 bg-blue-50 text-blue-700" },
  activity: { title: "Activity Log", description: "Audit events.", icon: Shield, tone: "border-slate-200 bg-slate-50 text-slate-600" },
  settings: { title: "Settings", description: "Preferences and data tools.", icon: Settings, tone: "border-teal-100 bg-teal-50 text-teal-700" },
};
