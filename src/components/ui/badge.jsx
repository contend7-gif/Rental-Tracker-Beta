import React from "react";

function cn(...parts) {
  return parts.filter(Boolean).join(" ");
}

const badgeVariants = {
  default: "bg-slate-950 text-white",
  destructive: "border border-rose-200 bg-rose-50 text-rose-700",
  secondary: "border border-slate-200 bg-slate-50 text-slate-700",
  outline: "border border-slate-200 bg-white text-slate-600",
};

export function Badge({ children, className, variant = "default", ...props }) {
  return (
    <span className={cn("rt-chip-text inline-flex items-center rounded-md px-1.5 py-px font-medium", badgeVariants[variant] || badgeVariants.default, className)} {...props}>
      {children}
    </span>
  );
}
