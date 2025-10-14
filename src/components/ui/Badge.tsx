import React from "react";
import { cn } from "../../utils/helpers";

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "new" | "past-due" | "success";
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = "default",
  className,
  children,
  ...props
}) => {
  const baseStyles =
    "inline-flex items-center px-3 py-1 text-xs font-semibold uppercase tracking-wide rounded transition-colors";

  const variants = {
    default: "bg-gray-100 text-gray-700",
    secondary: "bg-gray-100 text-gray-900",
    destructive: "bg-resilinc-alert text-white",
    outline: "border border-gray-300 text-gray-700",
    new: "bg-blue-50 text-resilinc-primary",
    "past-due": "bg-red-50 text-resilinc-alert",
    success: "bg-green-50 text-green-600",
  };

  return (
    <div className={cn(baseStyles, variants[variant], className)} {...props}>
      {children}
    </div>
  );
};
