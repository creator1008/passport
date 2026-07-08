/**
 * Anchor-first Korean TD3 MRZ parser.
 *
 * Parsing order (most reliable → least):
 * 1. Sex + expiry anchor  [MF]YYMMDD
 * 2. Passport number      M###X####
 * 3. DOB recovery         fuzzy middle block between passport and sex
 * 4. Issue date           optional tail / expiry − 10 years
 * 5. Canonical line2 rebuild + checksum validation
 */
import { parse as parseMrzLib } from "mrz";
import { parseNamesFromMrzLine1 } from "@/lib/passport/mrz-line";
import { computeMrzCheckDigit, matchesCheckDigit } from "@/lib/passport/mrz-engine/checksum";
import {
  inferIssueDateFromExpiry,
  isAdultIssueDate,
  isPlausibleBirthDate,
  parseMrzDate,
  sanitizeIsoDate,
} from "@/lib/passport/mrz-engine/dates";
import {
  hasCompleteLine2,
  isTruncatedLine2,
  KOR_PASSPORT_NUMBER_PATTERN,
  KOR_PASSPORT_NUMBER_RE,
  KOR_PASSPORT_WITH_CHECK_RE,
  normalizeLine1,
  normalizeLine2,
  TD3_LINE_LENGTH,
} from "@/lib/passport/mrz-engine/normalize";

export interface MrzBody {
  nationality: string;
  birthMrz: string;
  birthDate: string | null;
  birthCheck: string;
  sex: string;
  expiryMrz: string;
  expiryDate: string | null;
  expiryCheck: string;
  optionalTail: string;
}

export interface MrzParseResult {
  line1: string | null;
  line2: string | null;
  passportNumber: string | null;
  surname: string | null;
  givenNames: string | null;
  nationality: string | null;
  sex: string | null;
  dateOfBirth: string | null;
  dateOfIssue: string | null;
  dateOfExpiry: string | null;
  checksumValid: boolean;
  hasCompleteLine2: boolean;
  body: MrzBody | null;
  dobRecovered: boolean;
  line2Reconstructed: boolean;
}

interface SexExpiryAnchor {
  index: number;
  sex: string;
  expiryMrz: string;
  expiryDate: string | null;
  expiryCheck: string;
  optionalTail: string;
}

function findSexExpiryAnchors(line2: string): SexExpiryAnchor[] {
  const anchors: SexExpiryAnchor[] = [];

  for (const match of line2.matchAll(/([MF])(\d{6})(\d)(.*)/g)) {
    const expiryDate = parseMrzDate(match[2]);
    if (!expiryDate) continue;
    anchors.push({
      index: match.index ?? 0,
      sex: match[1],
      expiryMrz: match[2],
      expiryDate,
      expiryCheck: match[3],
      optionalTail: match[4] ?? "",
    });
  }

  return anchors.sort((a, b) => {
    const aFuture = a.expiryDate ? Number(a.expiryDate.slice(0, 4)) : 0;
    const bFuture = b.expiryDate ? Number(b.expiryDate.slice(0, 4)) : 0;
    return bFuture - aFuture;
  });
}

function pickBestAnchor(anchors: SexExpiryAnchor[]): SexExpiryAnchor | null {
  if (anchors.length === 0) return null;
  const future = anchors.filter((a) => {
    const year = Number(a.expiryDate?.slice(0, 4) ?? 0);
    return year >= 2020;
  });
  return future[0] ?? anchors[0];
}

function tryBirthFromDigits(
  digits: string,
  expiryIso: string | null,
): { birthMrz: string; birthCheck: string } | null {
  const variants = new Set<string>([digits]);

  for (const prefix of ["6", "61", "06", "60", "16", "2"]) {
    variants.add(`${prefix}${digits}`);
  }
  for (const suffix of ["7", "4", "0"]) {
    variants.add(`${digits}${suffix}`);
  }

  for (let insertPos = 0; insertPos <= digits.length; insertPos += 1) {
    for (const digit of "0123456789") {
      variants.add(`${digits.slice(0, insertPos)}${digit}${digits.slice(insertPos)}`);
    }
    for (let extra = 0; extra < 100; extra += 1) {
      const pair = String(extra).padStart(2, "0");
      variants.add(`${digits.slice(0, insertPos)}${pair}${digits.slice(insertPos)}`);
    }
  }

  for (const variant of variants) {
    for (const length of [7, 6] as const) {
      if (variant.length < length) continue;
      const birthMrz = variant.slice(0, 6);
      const birthCheck =
        length === 7 ? variant[6] : String(computeMrzCheckDigit(birthMrz));
      if (!/^\d{6}$/.test(birthMrz)) continue;
      if (!isPlausibleBirthDate(birthMrz, expiryIso)) continue;
      if (!matchesCheckDigit(birthMrz, birthCheck)) continue;
      return { birthMrz, birthCheck };
    }
  }

  return null;
}

function recoverBirthBlock(
  middle: string,
  expiryIso: string | null,
): { birthMrz: string; birthCheck: string } | null {
  const trimmed = middle.trim();
  if (!trimmed) return null;

  const korMatch = trimmed.match(/K[O0]R(\d{6})(\d)?/);
  if (korMatch) {
    const birthMrz = korMatch[1];
    const birthCheck = korMatch[2] ?? String(computeMrzCheckDigit(birthMrz));
    if (
      isPlausibleBirthDate(birthMrz, expiryIso) &&
      matchesCheckDigit(birthMrz, birthCheck)
    ) {
      return { birthMrz, birthCheck };
    }
  }

  const digits = trimmed.replace(/[^0-9]/g, "");
  if (digits.length < 4) return null;

  const direct = tryBirthFromDigits(digits, expiryIso);
  if (direct) return direct;

  const stripped = trimmed.replace(/^[A-Z2KOR]+/i, "");
  if (stripped !== trimmed) {
    const strippedDigits = stripped.replace(/[^0-9]/g, "");
    if (strippedDigits.length >= 4) {
      return tryBirthFromDigits(strippedDigits, expiryIso);
    }
  }

  return null;
}

function scanBirthCandidates(line2: string, expiryIso: string | null): MrzBody | null {
  for (const match of line2.matchAll(/(\d{6})(\d)([MF])(\d{6})(\d)(.*)/g)) {
    const birthMrz = match[1];
    const birthCheck = match[2];
    const sex = match[3];
    const expiryMrz = match[4];
    const expiryCheck = match[5];
    const birthDate = parseMrzDate(birthMrz);
    const expiryDate = parseMrzDate(expiryMrz);

    if (!birthDate || !expiryDate || birthDate >= expiryDate) continue;
    if (!isPlausibleBirthDate(birthMrz, expiryIso)) continue;
    if (!matchesCheckDigit(birthMrz, birthCheck)) continue;
    if (!matchesCheckDigit(expiryMrz, expiryCheck)) continue;

    return {
      nationality: "KOR",
      birthMrz,
      birthDate,
      birthCheck,
      sex,
      expiryMrz,
      expiryDate,
      expiryCheck,
      optionalTail: match[6] ?? "",
    };
  }
  return null;
}

export function extractMrzBody(line2: string): MrzBody | null {
  const normalized = normalizeLine2(line2);
  const anchor = pickBestAnchor(findSexExpiryAnchors(normalized));
  if (!anchor) return scanBirthCandidates(normalized, null);

  const scanned = scanBirthCandidates(normalized, anchor.expiryDate);
  if (scanned) return scanned;

  const korDirect = normalized.match(/K[O0]R(\d{6})(\d)([MF])(\d{6})(\d)(.*)/);
  if (korDirect) {
    const birthMrz = korDirect[1];
    const birthDate = parseMrzDate(birthMrz);
    if (birthDate && isPlausibleBirthDate(birthMrz, anchor.expiryDate)) {
      return {
        nationality: "KOR",
        birthMrz,
        birthDate,
        birthCheck: korDirect[2],
        sex: korDirect[3],
        expiryMrz: korDirect[4],
        expiryDate: parseMrzDate(korDirect[4]),
        expiryCheck: korDirect[5],
        optionalTail: korDirect[6] ?? "",
      };
    }
  }

  const beforeSex = normalized.slice(0, anchor.index);
  const passportMatch = beforeSex.match(new RegExp(`^(${KOR_PASSPORT_NUMBER_PATTERN})`));
  const passport = passportMatch?.[1] ?? null;
  const middleStart = passport ? passport.length : 0;
  let middle = beforeSex.slice(middleStart);

  if (middle.length > 0 && /^\d$/.test(middle[0]) && passport) {
    middle = middle.slice(1);
  }

  const recovered = recoverBirthBlock(middle, anchor.expiryDate);
  if (!recovered) return null;

  return {
    nationality: "KOR",
    birthMrz: recovered.birthMrz,
    birthDate: parseMrzDate(recovered.birthMrz),
    birthCheck: recovered.birthCheck,
    sex: anchor.sex,
    expiryMrz: anchor.expiryMrz,
    expiryDate: anchor.expiryDate,
    expiryCheck: anchor.expiryCheck,
    optionalTail: anchor.optionalTail,
  };
}

export function extractPassportFromLine2(line2: string): string | null {
  const n = normalizeLine2(line2);
  const atStart = n.match(KOR_PASSPORT_WITH_CHECK_RE);
  if (atStart) return atStart[0].slice(0, 9);
  const anywhere = n.match(KOR_PASSPORT_NUMBER_RE);
  return anywhere?.[0] ?? null;
}

export function extractPassportFromText(text: string): string | null {
  const match = text.toUpperCase().replace(/[^A-Z0-9]/g, "").match(KOR_PASSPORT_NUMBER_RE);
  return match?.[0] ?? null;
}

export function rebuildLine2(passport: string, body: MrzBody): string {
  const pass = passport.slice(0, 9);
  const passCheck = String(computeMrzCheckDigit(pass));
  const dobCheck = String(computeMrzCheckDigit(body.birthMrz));
  const expCheck = String(computeMrzCheckDigit(body.expiryMrz));
  return normalizeLine2(
    `${pass}${passCheck}${body.nationality}${body.birthMrz}${dobCheck}${body.sex}${body.expiryMrz}${expCheck}${body.optionalTail}`,
  );
}

function extractIssueDate(
  line2: string,
  expiryDate: string | null,
  birthDate: string | null,
): string | null {
  const n = normalizeLine2(line2);
  const expiry = expiryDate ?? parseMrzDate(n.match(/[MF](\d{6})/)?.[1] ?? "");

  if (hasCompleteLine2(n) && n.length >= 34 && expiry) {
    const issueRaw = n.slice(28, 34);
    if (/^\d{6}$/.test(issueRaw)) {
      const issue = parseMrzDate(issueRaw);
      if (issue && issue < expiry && isAdultIssueDate(issue, birthDate)) {
        return issue;
      }
    }
  }

  const sexExpiry = n.match(/[MF](\d{6})(\d)(.+)/);
  if (sexExpiry && expiry) {
    const rest = sexExpiry[3];
    for (let start = 0; start <= 3; start += 1) {
      const chunk = rest.slice(start, start + 6);
      if (!/^\d{6}$/.test(chunk)) continue;
      const issue = parseMrzDate(chunk);
      if (issue && issue < expiry && isAdultIssueDate(issue, birthDate)) {
        return issue;
      }
    }
    return inferIssueDateFromExpiry(expiry);
  }

  return null;
}

function validateTd3Checksums(line1: string, line2: string): boolean {
  try {
    const result = parseMrzLib([line1, line2.slice(0, TD3_LINE_LENGTH)], {
      autocorrect: false,
    });
    return result.valid;
  } catch {
    return false;
  }
}

export function parseMrz(
  lines: string[],
  passportHint?: string | null,
): MrzParseResult {
  const empty: MrzParseResult = {
    line1: null,
    line2: null,
    passportNumber: null,
    surname: null,
    givenNames: null,
    nationality: null,
    sex: null,
    dateOfBirth: null,
    dateOfIssue: null,
    dateOfExpiry: null,
    checksumValid: false,
    hasCompleteLine2: false,
    body: null,
    dobRecovered: false,
    line2Reconstructed: false,
  };

  if (!lines[0] || !lines[1]) return empty;

  const line1 = normalizeLine1(lines[0]);
  const line2Raw = normalizeLine2(lines[1]);
  const names = parseNamesFromMrzLine1(line1);

  let body = extractMrzBody(line2Raw);
  let dobRecovered = false;

  if (body && !line2Raw.includes(`KOR${body.birthMrz}`)) {
    dobRecovered = true;
  }

  let passport =
    passportHint ??
    extractPassportFromLine2(line2Raw) ??
    null;

  if (passport?.startsWith("KOR")) passport = null;

  let line2 = line2Raw;
  let line2Reconstructed = false;

  if (body && passport) {
    const rebuilt = rebuildLine2(passport, body);
    if (rebuilt !== line2Raw) {
      line2 = rebuilt;
      line2Reconstructed = true;
    }
  }

  const hasCompleteLine2Flag = hasCompleteLine2(line2);
  const checksumValid =
    hasCompleteLine2Flag && body
      ? validateTd3Checksums(line1, line2)
      : false;

  const dateOfBirth = body?.birthDate ?? null;
  const dateOfExpiry = body?.expiryDate ?? null;
  const dateOfIssue = extractIssueDate(line2, dateOfExpiry, dateOfBirth);

  return {
    line1,
    line2,
    passportNumber: passport,
    surname: names.surname,
    givenNames: names.givenNames,
    nationality: body?.nationality ?? "KOR",
    sex: body?.sex ?? null,
    dateOfBirth,
    dateOfIssue,
    dateOfExpiry,
    checksumValid,
    hasCompleteLine2: hasCompleteLine2Flag,
    body,
    dobRecovered,
    line2Reconstructed,
  };
}

export function resolvePassportFromSources(
  line2: string,
  line1: string | null,
  ...sources: string[]
): string | null {
  const body = extractMrzBody(line2);
  if (!body) return extractPassportFromLine2(line2);

  const compact = sources
    .filter(Boolean)
    .map((s) => s.toUpperCase().replace(/[^A-Z0-9]/g, ""))
    .join("");

  const suffix = `KOR${body.birthMrz}${body.birthCheck}${body.sex}${body.expiryMrz}`.slice(0, 16);
  const anchored = compact.match(
    new RegExp(`(${KOR_PASSPORT_NUMBER_PATTERN})(\\d)${suffix.slice(0, 12)}`),
  );
  if (anchored?.[1]) return anchored[1];

  const candidates = new Set<string>();
  for (const source of sources) {
    const found = extractPassportFromText(source);
    if (found) candidates.add(found);
  }

  for (const pass of candidates) {
    const rebuilt = rebuildLine2(pass, body);
    if (line1 && validateTd3Checksums(line1, rebuilt)) return pass;
    if (hasCompleteLine2(rebuilt)) return pass;
  }

  return candidates.values().next().value ?? null;
}

export function toPassportFields(result: MrzParseResult) {
  const essential =
    Boolean(result.passportNumber) &&
    Boolean(result.dateOfBirth) &&
    Boolean(result.dateOfExpiry);

  return {
    passportNumber: result.passportNumber,
    surname: result.surname,
    givenNames: result.givenNames,
    nationality: result.nationality,
    sex: result.sex,
    dateOfBirth: sanitizeIsoDate(result.dateOfBirth),
    dateOfIssue: sanitizeIsoDate(result.dateOfIssue),
    dateOfExpiry: sanitizeIsoDate(result.dateOfExpiry),
    mrzLine1: result.line1,
    mrzLine2: result.line2,
    mrzValid: result.checksumValid || essential,
  };
}

// Backward-compatible aliases
export const extractKorBody = extractMrzBody;
export const parseKoreanMrz = parseMrz;
export type KorMrzBody = MrzBody;
export type KoreanMrzResult = MrzParseResult;
