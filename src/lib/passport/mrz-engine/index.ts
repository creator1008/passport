export {
  computeMrzCheckDigit,
  matchesCheckDigit,
} from "@/lib/passport/mrz-engine/checksum";
export {
  inferIssueDateFromExpiry,
  isAdultIssueDate,
  isPlausibleBirthDate,
  isValidIsoDate,
  parseMrzDate,
  sanitizeIsoDate,
} from "@/lib/passport/mrz-engine/dates";
export {
  hasCompleteLine2,
  isTruncatedLine2,
  KOR_PASSPORT_NUMBER_PATTERN,
  KOR_PASSPORT_NUMBER_RE,
  KOR_PASSPORT_WITH_CHECK_RE,
  normalizeLine1,
  normalizeLine2,
  TD3_LINE_LENGTH,
} from "@/lib/passport/mrz-engine/normalize";
export {
  extractKorBody,
  extractMrzBody,
  extractPassportFromLine2,
  extractPassportFromText,
  parseKoreanMrz,
  parseMrz,
  rebuildLine2,
  resolvePassportFromSources,
  toPassportFields,
} from "@/lib/passport/mrz-engine/parse";
export type {
  KorMrzBody,
  KoreanMrzResult,
  MrzBody,
  MrzParseResult,
} from "@/lib/passport/mrz-engine/parse";
