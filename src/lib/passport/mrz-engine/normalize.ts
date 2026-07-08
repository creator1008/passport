import { cleanMrzLine1Ocr } from "@/lib/passport/mrz-line";

export const TD3_LINE_LENGTH = 44;
export const KOR_PASSPORT_NUMBER_PATTERN = "M\\d{3}[A-Z]\\d{4}";
export const KOR_PASSPORT_NUMBER_RE = new RegExp(KOR_PASSPORT_NUMBER_PATTERN);
export const KOR_PASSPORT_WITH_CHECK_RE = new RegExp(
  `${KOR_PASSPORT_NUMBER_PATTERN}\\d?`,
);

export function normalizeLine2(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9]/g, "")
    .replace(/K0OR/g, "KOR")
    .replace(/KOO/g, "KOR")
    .replace(/K0R/g, "KOR")
    .replace(/^MO(\d{2})/, "M0$1");
}

export function normalizeLine1(raw: string): string {
  let cleaned = cleanMrzLine1Ocr(raw)
    .toUpperCase()
    .replace(/^PPOR/, "PPKOR")
    .replace(/^PP0R/, "PPKOR")
    .replace(/^PPO([RK])/, "PPK$1");

  if (cleaned.length >= TD3_LINE_LENGTH) return cleaned.slice(0, TD3_LINE_LENGTH);
  return cleaned.padEnd(TD3_LINE_LENGTH, "<");
}

export function hasCompleteLine2(line2: string): boolean {
  return /^M\d{3}[A-Z]\d{4}\d/.test(normalizeLine2(line2));
}

export function isTruncatedLine2(line2: string): boolean {
  const n = normalizeLine2(line2);
  return /^K[O0]R\d{6}/.test(n) && !hasCompleteLine2(n);
}
