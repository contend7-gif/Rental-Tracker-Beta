import React from "react";

function cn(...parts) {
  return parts.filter(Boolean).join(" ");
}

const buttonVariants = {
  default: "bg-teal-700 text-white shadow-sm hover:bg-teal-600",
  secondary: "border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50",
  destructive: "bg-red-600 text-white shadow-sm hover:bg-red-500",
  ghost: "text-slate-700 hover:bg-slate-100 hover:text-slate-950",
};

const buttonSizes = {
  default: "h-8 px-3 py-1.5",
  sm: "h-7 px-2.5",
  lg: "h-9 px-4",
  icon: "h-8 w-8",
};

export function Button({ children, className, variant = "default", size = "default", type = "button", ...props }) {
  return (
    <button
      type={type}
      className={cn(
        "rt-button-text inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
        buttonVariants[variant] || buttonVariants.default,
        buttonSizes[size] || buttonSizes.default,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
