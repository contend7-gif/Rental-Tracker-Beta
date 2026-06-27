import React from "react";

function cn(...parts) {
  return parts.filter(Boolean).join(" ");
}

export function Input({ className, ...props }) {
  return (
    <input
      className={cn(
        "h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[13px] shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-100",
        className,
      )}
      {...props}
    />
  );
}
