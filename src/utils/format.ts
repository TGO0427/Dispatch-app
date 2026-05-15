const NUMBER_FORMATTER = new Intl.NumberFormat("en-ZA");

export function formatNumber(value: number | undefined | null, fallback = "-"): string {
  if (value === undefined || value === null || Number.isNaN(value)) return fallback;
  return NUMBER_FORMATTER.format(value);
}

export function formatPercent(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "0%";
  return `${value.toFixed(digits)}%`;
}

export function formatDateTime(dateString: string | Date | undefined | null, fallback = "-"): string {
  if (!dateString) return fallback;
  const date = dateString instanceof Date ? dateString : new Date(dateString);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(dateString: string | Date | undefined | null, fallback = "-"): string {
  if (!dateString) return fallback;
  const date = dateString instanceof Date ? dateString : new Date(dateString);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatShortDate(dateString: string | Date | undefined | null, fallback = "-"): string {
  if (!dateString) return fallback;
  const date = dateString instanceof Date ? dateString : new Date(dateString);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}

export function formatClockTime(dateString: string | Date | undefined | null, fallback = "-"): string {
  if (!dateString) return fallback;
  const date = dateString instanceof Date ? dateString : new Date(dateString);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
