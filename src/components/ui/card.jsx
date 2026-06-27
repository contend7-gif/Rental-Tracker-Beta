import React from "react";

function cn(...parts) {
  return parts.filter(Boolean).join(" ");
}

export function Card({ children, className, ...props }) {
  return (
    <section className={cn("rounded-lg border border-slate-200 bg-white shadow-sm", className)} {...props}>
      {children}
    </section>
  );
}

export function CardHeader({ children, className, ...props }) {
  return (
    <header className={cn("space-y-1.5 px-4 py-3", className)} {...props}>
      {children}
    </header>
  );
}

export function CardTitle({ children, className, ...props }) {
  return (
    <h3 className={cn("rt-card-title", className)} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ children, className, ...props }) {
  return (
    <p className={cn("rt-page-subtitle", className)} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ children, className, ...props }) {
  return (
    <div className={cn("p-3 pt-0", className)} {...props}>
      {children}
    </div>
  );
}
