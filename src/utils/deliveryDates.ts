import { Job, TRANSPORT_SERVICES, TransportService } from "../types";

const MS_PER_DAY = 86400000;

function parseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function toDateOnly(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function formatDateOnly(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function subtractBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let remaining = days;

  while (remaining > 0) {
    result.setDate(result.getDate() - 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) remaining--;
  }

  while (result.getDay() === 0 || result.getDay() === 6) {
    result.setDate(result.getDate() - 1);
  }

  return result;
}

export function calculateETD(eta: string | undefined, service: TransportService | undefined): string | undefined {
  if (!eta || !service) return undefined;
  const serviceConfig = TRANSPORT_SERVICES.find((item) => item.value === service);
  const etaDate = parseDate(eta);
  if (!serviceConfig || !etaDate) return undefined;

  if (serviceConfig.businessDays === 0) return formatDateOnly(etaDate);

  const businessDays = Math.ceil(serviceConfig.hours / 24);
  return formatDateOnly(subtractBusinessDays(etaDate, businessDays));
}

export function getDeliveryDelayDays(job: Pick<Job, "eta" | "actualDeliveryAt">): number | undefined {
  const etaDate = parseDate(job.eta);
  const actualDate = parseDate(job.actualDeliveryAt);
  if (!etaDate || !actualDate) return undefined;

  return Math.floor((toDateOnly(actualDate).getTime() - toDateOnly(etaDate).getTime()) / MS_PER_DAY);
}

export function calculateRevisedETD(
  job: Pick<Job, "eta" | "etd" | "actualDeliveryAt" | "transportService">
): string | undefined {
  const delayDays = getDeliveryDelayDays(job);
  if (delayDays === undefined || delayDays <= 0) return undefined;

  if (job.transportService) {
    return calculateETD(job.actualDeliveryAt, job.transportService);
  }

  const etaDate = parseDate(job.eta);
  const actualDate = parseDate(job.actualDeliveryAt);
  const originalEtdDate = parseDate(job.etd);
  if (!etaDate || !actualDate || !originalEtdDate) return undefined;

  const transitDays = Math.max(
    0,
    Math.round((toDateOnly(etaDate).getTime() - toDateOnly(originalEtdDate).getTime()) / MS_PER_DAY)
  );
  const revisedDate = toDateOnly(actualDate);
  revisedDate.setDate(revisedDate.getDate() - transitDays);
  return formatDateOnly(revisedDate);
}
