import React from "react";

function cn(...parts) {
  return parts.filter(Boolean).join(" ");
}

export function Label({ children, className, ...props }) {
  return (
    <label className={cn("mb-1 block text-xs font-medium text-slate-700", className)} {...props}>
      {children}
    </label>
  );
}
