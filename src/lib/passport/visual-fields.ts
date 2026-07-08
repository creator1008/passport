import sharp from "sharp";
import { KOR_PASSPORT_NUMBER_RE } from "@/lib/passport/mrz-engine";
import {
  extractPassportNumberFromText,
  resolvePassportFromTruncatedLine2,
} from "@/lib/passport/passport-number";

const MONTH_MAP: Record<string, string> = {
  JAN: "01",
  FEB: "02",
  MAR: "03",
  APR: "04",
  MAY: "05",
  JUN: "06",
  JUL: "07",
  AUG: "08",
  SEP: "09",
  OCT: "10",
  NOV: "11",
  DEC: "12",
};

const MONTH_ALIASES: Record<string, string> = {
  JANUARY: "01",
  FEBRUARY: "02",
  MARCH: "03",
  APRIL: "04",
  MAYO: "05",
  JUNE: "06",
  JULY: "07",
  AUGUST: "08",
  SEPTEMBER: "09",
  OCTOBER: "10",
  NOVEMBER: "11",
  DECEMBER: "12",
  AUGU: "08",
  SEPT: "09",
};

const ENGLISH_DATE =
  /(\d{1,2})\s*(?:\d{1,2}\s*월\s*\/?\s*)?([A-Z]{3,9})\s+(\d{2,4})/gi;

const KOREAN_MONTH_DATE =
  /(\d{1,2})\s*(\d{1,2})\s*월\s*\/?\s*([A-Z]{3,9})\s+(\d{4})/gi;

const NUMERIC_DATE = /(\d{1,2})\s+(\d{1,2})\s+(\d{4})/g;

function normalizeOcrText(text: string): string {
  return text
    .replace(/[|]/g, "1")
    .replace(/(\d)O(\d)/g, "$10$2")
    .replace(/O(?=\d{3}\b)/g, "0")
    .replace(/\s+/g, " ");
}

function parseMonthToken(token: string): string | null {
  const upper = token.toUpperCase().replace(/[^A-Z]/g, "");
  const key3 = upper.slice(0, 3);
  if (MONTH_MAP[key3]) return MONTH_MAP[key3];
  if (MONTH_ALIASES[upper]) return MONTH_ALIASES[upper];

  for (const [alias, mm] of Object.entries(MONTH_ALIASES)) {
    if (upper.startsWith(alias.slice(0, 3))) return mm;
  }

  return null;
}

function toIsoDate(day: string, month: string, year: string): string | null {
  const mm = parseMonthToken(month);
  if (!mm) return null;

  const yyyy = year.length === 2 ? `20${year}` : year;
  return `${yyyy}-${mm}-${day.padStart(2, "0")}`;
}

function parseEnglishDateMatch(match: RegExpMatchArray): string | null {
  return toIsoDate(match[1], match[2], match[3]);
}

function collectEnglishDates(text: string): string[] {
  const normalized = normalizeOcrText(text);
  const dates: string[] = [];

  for (const match of normalized.matchAll(ENGLISH_DATE)) {
    const iso = parseEnglishDateMatch(match);
    if (iso) dates.push(iso);
  }

  for (const match of normalized.matchAll(KOREAN_MONTH_DATE)) {
    const iso = toIsoDate(match[1], match[3], match[4]);
    if (iso) dates.push(iso);
  }

  return dates;
}

function collectNumericDates(text: string): string[] {
  const dates: string[] = [];
  for (const match of text.matchAll(NUMERIC_DATE)) {
    const day = match[1].padStart(2, "0");
    const month = match[2].padStart(2, "0");
    const year = match[3];
    const monthNum = Number(month);
    if (monthNum >= 1 && monthNum <= 12) {
      dates.push(`${year}-${month}-${day}`);
    }
  }
  return dates;
}

type CropSpec = { left: number; top: number; width: number; height: number };

async function cropRegion(buffer: Buffer, spec: CropSpec): Promise<Buffer> {
  const metadata = await sharp(buffer).metadata();
  const imgWidth = metadata.width ?? 0;
  const imgHeight = metadata.height ?? 0;

  const left = Math.floor(imgWidth * spec.left);
  const top = Math.floor(imgHeight * spec.top);
  const width = Math.floor(imgWidth * spec.width);
  const height = Math.floor(imgHeight * spec.height);

  return sharp(buffer)
    .extract({ left, top, width, height })
    .resize({ width: Math.min(2400, width * 2), withoutEnlargement: false })
    .greyscale()
    .normalize()
    .sharpen()
    .toBuffer();
}

const VISUAL_REGIONS: CropSpec[] = [
  { left: 0.3, top: 0.12, width: 0.7, height: 0.58 },
  { left: 0.42, top: 0.28, width: 0.55, height: 0.35 },
  { left: 0.0, top: 0.1, width: 1.0, height: 0.72 },
];

export function extractIssueDateFromText(
  text: string,
  knownDob: string | null,
  knownExpiry: string | null,
): string | null {
  const normalized = normalizeOcrText(text);
  const lines = normalized.split(/\r?\n/);
  const issuePattern = /(?:date\s*of\s*issue|date\s*of\s*lssue|발급\s*일|발급일|발급)/i;

  for (let i = 0; i < lines.length; i += 1) {
    if (!issuePattern.test(lines[i])) continue;

    const window = lines.slice(i, i + 5).join(" ");
    const match = window.match(
      /(\d{1,2})\s*(?:\d{1,2}\s*월\s*\/?\s*)?([A-Z]{3,9})\s+(\d{2,4})/i,
    );
    if (match) {
      const parsed = parseEnglishDateMatch(match);
      if (parsed) return parsed;
    }
  }

  const allDates = [
    ...collectEnglishDates(normalized),
    ...collectNumericDates(normalized),
  ];
  const excluded = new Set([knownDob, knownExpiry].filter(Boolean));

  const candidates = [...new Set(allDates)].filter((date) => !excluded.has(date));
  if (candidates.length === 1) {
    return candidates[0];
  }

  if (candidates.length > 1 && knownExpiry) {
    const expiryYear = Number(knownExpiry.slice(0, 4));
    const issueCandidate = candidates
      .filter((date) => {
        const year = Number(date.slice(0, 4));
        return year < expiryYear && year >= expiryYear - 15;
      })
      .sort((a, b) => b.localeCompare(a))[0];
    if (issueCandidate) return issueCandidate;
  }

  return candidates[0] ?? null;
}

export function inferIssueDateFromExpiry(
  knownExpiry: string | null,
): string | null {
  if (!knownExpiry) return null;

  const expiry = new Date(knownExpiry);
  if (Number.isNaN(expiry.getTime())) return null;

  const issue = new Date(expiry);
  issue.setFullYear(issue.getFullYear() - 10);

  const yyyy = issue.getFullYear();
  const mm = String(issue.getMonth() + 1).padStart(2, "0");
  const dd = String(issue.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export { extractPassportNumberFromText } from "@/lib/passport/passport-number";

const PASSPORT_NUMBER_REGIONS: CropSpec[] = [
  { left: 0.52, top: 0.08, width: 0.45, height: 0.12 },
  { left: 0.48, top: 0.06, width: 0.5, height: 0.16 },
  { left: 0.4, top: 0.05, width: 0.58, height: 0.2 },
  { left: 0.3, top: 0.1, width: 0.68, height: 0.28 },
];

export async function extractPassportNumberFromImage(
  buffer: Buffer,
  line2?: string | null,
): Promise<{ passportNumber: string | null; rawText: string }> {
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("eng");
  const ocrChunks: string[] = [];

  try {
    for (const spec of PASSPORT_NUMBER_REGIONS) {
      const region = await cropRegion(buffer, spec);
      await worker.setParameters({
        tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
      });
      const { data } = await worker.recognize(region);
      ocrChunks.push(data.text);
      const found = extractPassportNumberFromText(data.text, line2);
      if (found) {
        return { passportNumber: found, rawText: ocrChunks.join("\n---\n") };
      }
    }

    const combined = ocrChunks.join("\n");
    return {
      passportNumber: extractPassportNumberFromText(combined, line2),
      rawText: combined,
    };
  } finally {
    await worker.terminate();
  }
}

export async function extractVisualFields(
  buffer: Buffer,
  knownDob: string | null,
  knownExpiry: string | null,
): Promise<{
  dateOfIssue: string | null;
  passportNumber: string | null;
  inferred: boolean;
  rawText: string;
}> {
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("eng");

  const ocrChunks: string[] = [];

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
    });

    for (const spec of VISUAL_REGIONS) {
      const region = await cropRegion(buffer, spec);
      const { data } = await worker.recognize(region);
      ocrChunks.push(data.text);

      const found = extractIssueDateFromText(
        data.text,
        knownDob,
        knownExpiry,
      );
      if (found) {
        return {
          dateOfIssue: found,
          passportNumber: extractPassportNumberFromText(data.text, null),
          inferred: false,
          rawText: ocrChunks.join("\n---\n"),
        };
      }
    }

    const combined = ocrChunks.join("\n");
    const fromCombined = extractIssueDateFromText(
      combined,
      knownDob,
      knownExpiry,
    );
    if (fromCombined) {
      return {
        dateOfIssue: fromCombined,
        passportNumber: extractPassportNumberFromText(combined, null),
        inferred: false,
        rawText: combined,
      };
    }

    const inferred = inferIssueDateFromExpiry(knownExpiry);
    return {
      dateOfIssue: inferred,
      passportNumber: extractPassportNumberFromText(combined),
      inferred: Boolean(inferred),
      rawText: combined,
    };
  } finally {
    await worker.terminate();
  }
}
