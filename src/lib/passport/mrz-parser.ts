import { parseMrz, toPassportFields } from "@/lib/passport/mrz-engine";
import type { PassportFields } from "@/lib/types";

export { parseNamesFromMrzLine1, sanitizeGivenNames } from "@/lib/passport/mrz-line";

export function parseMrzLines(
  lines: string[],
  options?: { passportNumber?: string | null },
): {
  fields: PassportFields;
  raw: Record<string, unknown>;
} {
  const result = parseMrz(lines, options?.passportNumber);
  return {
    fields: toPassportFields(result),
    raw: { engine: "mrz-engine", result },
  };
}

export { resolvePassportFromSources } from "@/lib/passport/mrz-engine";
