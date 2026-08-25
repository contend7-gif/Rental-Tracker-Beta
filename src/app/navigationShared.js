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
  ["dashboard", "Home", Home],
  ["review", "Work Queue", ClipboardCheck],
];

export const propertyAccountingNavItems = [
  ["properties", "Properties", Building2],
  ["leaseHistory", "Leases", CalendarDays],
  ["maintenance", "Maintenance", Archive],
  ["documents", "Documents", FolderOpen],
];

export const accountingNavItems = [
  ["ledger", "Transactions", Table2],
  ["loans", "Loans", Landmark],
  ["assets", "Depreciation", Wallet],
  ["tax", "Tax Center", Receipt],
];

export const planningNavItems = [
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
  ...accountingNavItems,
  ...planningNavItems,
  ["settings", "Settings", Settings],
];

export const navGroups = [
  { key: "overview", label: "Overview", items: primaryNavItems },
  { key: "portfolio", label: "Portfolio", items: propertyAccountingNavItems },
  { key: "accounting", label: "Accounting", items: accountingNavItems },
  { key: "planning", label: "Plan", items: planningNavItems },
  { key: "system", label: "", items: [["settings", "Settings", Settings]] },
];

export const viewDetails = {
  dashboard: { title: "Home", description: "Portfolio status and next actions.", icon: Home, tone: "border-teal-100 bg-teal-50 text-teal-700" },
  quickAdd: { title: "New Transaction", description: "Record income, expenses, and payments.", icon: PlusCircle, tone: "border-emerald-100 bg-emerald-50 text-emerald-700" },
  ledger: { title: "Transactions", description: "Inspect posted activity, recurring schedules, and bank imports.", icon: Table2, tone: "border-blue-100 bg-blue-50 text-blue-700" },
  review: { title: "Work Queue", description: "Resolve records needing attention across the portfolio.", icon: ClipboardCheck, tone: "border-amber-100 bg-amber-50 text-amber-700" },
  recurring: { title: "Recurring", description: "Recurring transaction rules.", icon: CalendarDays, tone: "border-violet-100 bg-violet-50 text-violet-700" },
  properties: { title: "Properties", description: "Property health, units, occupancy, records, and photos.", icon: Building2, tone: "border-cyan-100 bg-cyan-50 text-cyan-700" },
  leaseHistory: { title: "Leases", description: "Lease and occupancy records.", icon: CalendarDays, tone: "border-violet-100 bg-violet-50 text-violet-700" },
  maintenance: { title: "Maintenance", description: "Active repairs, history, accounting cleanup, and vendors.", icon: Archive, tone: "border-orange-100 bg-orange-50 text-orange-700" },
  assets: { title: "Depreciation Assets", description: "Asset overview, register, schedules, and source cleanup.", icon: Wallet, tone: "border-indigo-100 bg-indigo-50 text-indigo-700" },
  loans: { title: "Loans", description: "Debt overview, payments, tax review, and loan details.", icon: Landmark, tone: "border-sky-100 bg-sky-50 text-sky-700" },
  planning: { title: "Planning", description: "Forecasts and scenarios.", icon: ArrowUpRight, tone: "border-purple-100 bg-purple-50 text-purple-700" },
  tax: { title: "Tax Center", description: "Summary, Schedule E, review work, and filing package.", icon: Receipt, tone: "border-emerald-100 bg-emerald-50 text-emerald-700" },
  documents: { title: "Documents", description: "Files and supporting records.", icon: FolderOpen, tone: "border-blue-100 bg-blue-50 text-blue-700" },
  activity: { title: "Activity Log", description: "Audit events.", icon: Shield, tone: "border-slate-200 bg-slate-50 text-slate-600" },
  settings: { title: "Settings", description: "Preferences and data tools.", icon: Settings, tone: "border-teal-100 bg-teal-50 text-teal-700" },
};
