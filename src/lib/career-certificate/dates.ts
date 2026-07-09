export function isValidIsoDate(value: string | null | undefined): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const parsed = new Date(value);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month &&
    parsed.getUTCDate() === day
  );
}

export function sanitizeIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  return isValidIsoDate(value) ? value : null;
}

const DATE_PATTERNS = [
  /(\d{4})\s*[년.\-/]\s*(\d{1,2})\s*[월.\-/]\s*(\d{1,2})\s*일?/,
  /(\d{4})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})/,
  /(\d{4})(\d{2})(\d{2})/,
];

export function parseKoreanDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/\s+/g, " ");

  for (const pattern of DATE_PATTERNS) {
    const match = trimmed.match(pattern);
    if (!match) continue;
    const yyyy = match[1];
    const mm = String(Number(match[2])).padStart(2, "0");
    const dd = String(Number(match[3])).padStart(2, "0");
    const iso = `${yyyy}-${mm}-${dd}`;
    if (isValidIsoDate(iso)) return iso;
  }

  return null;
}

export function monthsBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return (
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth()) +
    1
  );
}
