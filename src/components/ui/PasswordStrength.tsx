import React from "react";
import { Check, X } from "lucide-react";

interface PasswordStrengthProps {
  password: string;
}

interface Requirement {
  label: string;
  test: (p: string) => boolean;
}

const REQUIREMENTS: Requirement[] = [
  { label: "At least 12 characters", test: (p) => p.length >= 12 },
  { label: "Uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { label: "Lowercase letter", test: (p) => /[a-z]/.test(p) },
  { label: "Number", test: (p) => /\d/.test(p) },
  { label: "Special character", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

function scorePassword(password: string): number {
  if (!password) return 0;
  return REQUIREMENTS.filter((r) => r.test(password)).length;
}

function strengthLabel(score: number): { label: string; color: string } {
  if (score <= 1) return { label: "Very weak", color: "#dc2626" };
  if (score === 2) return { label: "Weak", color: "#f97316" };
  if (score === 3) return { label: "Fair", color: "#eab308" };
  if (score === 4) return { label: "Strong", color: "#52A547" };
  return { label: "Very strong", color: "#3F8A37" };
}

export const PasswordStrength: React.FC<PasswordStrengthProps> = ({ password }) => {
  if (!password) return null;

  const score = scorePassword(password);
  const { label, color } = strengthLabel(score);
  const pct = (score / REQUIREMENTS.length) * 100;

  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-gray-600">Password strength</span>
        <span className="text-xs font-semibold" style={{ color }}>
          {label}
        </span>
      </div>
      <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full transition-all duration-200"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <ul className="mt-2 space-y-1">
        {REQUIREMENTS.map((req) => {
          const met = req.test(password);
          return (
            <li key={req.label} className="flex items-center gap-1.5 text-xs">
              {met ? (
                <Check className="w-3.5 h-3.5" style={{ color: "#52A547" }} aria-hidden="true" />
              ) : (
                <X className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />
              )}
              <span className={met ? "text-gray-700" : "text-gray-500"}>{req.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
