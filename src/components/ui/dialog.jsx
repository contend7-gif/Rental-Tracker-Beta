import React, { useEffect } from "react";

function cn(...parts) {
  return parts.filter(Boolean).join(" ");
}

export function Dialog({ open, onOpenChange, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onOpenChange?.(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 cursor-default bg-slate-900/40"
        onClick={() => onOpenChange?.(false)}
      />
      <div className="relative z-10 w-full">{children}</div>
    </div>
  );
}

export function DialogContent({ children, className, ...props }) {
  return (
    <div className={cn("mx-auto w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl", className)} {...props}>
      {children}
    </div>
  );
}

export function DialogHeader({ children, className, ...props }) {
  return (
    <div className={cn("space-y-1.5", className)} {...props}>
      {children}
    </div>
  );
}

export function DialogTitle({ children, className, ...props }) {
  return (
    <h2 className={cn("text-lg font-semibold text-slate-900", className)} {...props}>
      {children}
    </h2>
  );
}
