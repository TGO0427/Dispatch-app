import React from "react";
import { cn } from "../../utils/helpers";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "destructive" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = "default",
  size = "default",
  className,
  children,
  ...props
}) => {
  const baseStyles =
    "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

  const variants = {
    default: "bg-resilinc-primary text-white hover:bg-resilinc-primary-dark",
    outline: "border border-resilinc-primary bg-white text-resilinc-primary hover:bg-blue-50",
    destructive: "bg-resilinc-alert text-white hover:bg-red-600",
    ghost: "hover:bg-gray-50 text-gray-700",
  };

  const sizes = {
    default: "h-10 px-4 py-2 rounded-card text-sm",
    sm: "h-9 px-3 text-sm rounded-card",
    lg: "h-11 px-8 rounded-card text-sm",
    icon: "h-10 w-10 rounded-card",
  };

  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </button>
  );
};
