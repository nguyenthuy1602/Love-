import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

function normalizeDateInput(date) {
  if (date === undefined || date === null) return null;
  const raw = String(date).trim();
  if (!raw) return null;

  const normalized = raw.replace(" ", "T");
  if (/[zZ]$|[+\-]\d{2}:?\d{2}$/.test(normalized)) {
    return normalized;
  }

  return `${normalized}Z`;
}

export function parseDate(date) {
  const normalized = normalizeDateInput(date);
  if (!normalized) return null;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function timeAgo(date) {
  const parsed = parseDate(date);
  if (!parsed) return "";
  return formatDistanceToNow(parsed, { addSuffix: true, locale: vi });
}
