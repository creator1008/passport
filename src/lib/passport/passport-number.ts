import { parse as parseMrz } from "mrz";
import sharp from "sharp";
import { locateMrzBand } from "@/lib/passport/quality-check";
import {
  computeMrzCheckDigit,
  extractMrzBody,
  isTruncatedLine2,
  KOR_PASSPORT_NUMBER_PATTERN,
  KOR_PASSPORT_NUMBER_RE,
  KOR_PASSPORT_WITH_CHECK_RE,
  normalizeLine2,
  rebuildLine2,
} from "@/lib/passport/mrz-engine";

const DIGIT_CONFUSIONS: Record<string, string[]> = {
  "0": ["O", "8"],
  O: ["0"],
  "3": ["9", "8"],
  "9": ["3", "8"],
  "8": ["3", "6", "B"],
  "6": ["8", "5", "G"],
  "5": ["6", "S"],
  "1": ["I", "7"],
  I: ["1"],
  B: ["8"],
};

export function generatePassportVariants(passport: string): string[] {
  const variants = new Set<string>([passport.toUpperCase()]);
  const upper = passport.toUpperCase();

  for (let i = 1; i < upper.length; i += 1) {
    if (i === 4) continue;
    const char = upper[i];
    if (!/\d/.test(char)) continue;
    for (const alt of DIGIT_CONFUSIONS[char] ?? []) {
      variants.add(upper.slice(0, i) + alt + upper.slice(i + 1));
    }
  }

  return [...variants].filter((value) => KOR_PASSPORT_NUMBER_RE.test(value));
}

export function collectPassportCandidates(text: string): string[] {
  const compact = text.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const found = new Set<string>();

  for (const match of compact.matchAll(new RegExp(KOR_PASSPORT_NUMBER_PATTERN, "g"))) {
    found.add(match[0]);
  }

  const labeled = text.toUpperCase().match(
    /(?:PASSPORT\s*(?:NO\.?|NUMBER)?|여권\s*번호|여권번호)[:\s]*([A-Z0-9]{9,10})/,
  );
  if (labeled?.[1]) {
    const normalized = normalizeLine2(labeled[1]).slice(0, 9);
    if (KOR_PASSPORT_NUMBER_RE.test(normalized)) {
      found.add(normalized);
    }
  }

  return [...found];
}

export function isValidPassportForTruncatedLine2(
  passport: string,
  line2: string,
  line1?: string | null,
): boolean {
  if (!KOR_PASSPORT_NUMBER_RE.test(passport) || !isTruncatedLine2(line2)) {
    return false;
  }

  const body = extractMrzBody(line2);
  if (!body) return false;

  const rebuilt = rebuildLine2(passport, body);
  const check = String(computeMrzCheckDigit(passport));
  if (!rebuilt.startsWith(`${passport}${check}KOR`)) return false;

  if (line1) {
    try {
      const result = parseMrz([line1, rebuilt.slice(0, 44)], { autocorrect: false });
      if (!result.valid) return false;
    } catch {
      return false;
    }
  }

  return true;
}

function preferredChangePosition(passport: string, textSources: string[]): number {
  for (const source of textSources) {
    for (const candidate of collectPassportCandidates(source)) {
      if (passport === candidate) return 99;
      for (let i = 8; i >= 0; i -= 1) {
        if (passport[i] !== candidate[i]) return i;
      }
    }
  }
  return -1;
}

function scorePassportCandidate(
  passport: string,
  line2: string,
  line1: string | null | undefined,
  compact: string,
  textSources: string[],
): number {
  if (!isValidPassportForTruncatedLine2(passport, line2, line1)) {
    return -1;
  }

  const check = String(computeMrzCheckDigit(passport));
  let score = 1;
  if (compact.includes(passport)) score += 5;
  if (compact.includes(`${passport}${check}`)) score += 10;
  if (compact.includes(`${passport}${check}KOR`)) score += 20;
  score += preferredChangePosition(passport, textSources) * 0.5;
  return score;
}

export function resolvePassportFromTruncatedLine2(
  line2: string,
  line1?: string | null,
  ...textSources: string[]
): string | null {
  if (!isTruncatedLine2(line2)) return null;

  const body = extractMrzBody(line2);
  if (!body) return null;

  const normalized = normalizeLine2(line2);
  const korSuffix = normalized.replace(/^K[O0]R/, "");
  const compact = textSources
    .filter(Boolean)
    .map((text) => text.toUpperCase().replace(/[^A-Z0-9]/g, ""))
    .join("");

  const anchored = compact.match(
    new RegExp(
      `(${KOR_PASSPORT_NUMBER_PATTERN})(\\d)K[O0]R${korSuffix.slice(0, 10)}`,
    ),
  );
  if (anchored?.[1] && isValidPassportForTruncatedLine2(anchored[1], line2, line1)) {
    return anchored[1];
  }

  const candidates = new Set<string>();
  for (const source of textSources) {
    for (const candidate of collectPassportCandidates(source)) {
      candidates.add(candidate);
      for (const variant of generatePassportVariants(candidate)) {
        candidates.add(variant);
      }
    }
  }

  let best: { pass: string; score: number } | null = null;
  for (const pass of candidates) {
    const score = scorePassportCandidate(pass, line2, line1, compact, textSources);
    if (score < 0) continue;
    if (!best || score > best.score) {
      best = { pass, score };
    }
  }

  return best?.pass ?? null;
}

export async function extractMrzLine2PrefixFromImage(
  buffer: Buffer,
): Promise<{ prefixText: string; line2Text: string; rawText: string }> {
  const metadata = await sharp(buffer).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (!width || !height) {
    return { prefixText: "", line2Text: "", rawText: "" };
  }

  const band = await locateMrzBand(buffer);
  const cropTop = band
    ? Math.max(band.top - Math.floor(height * 0.04), Math.floor(height * 0.55))
    : Math.floor(height * 0.58);
  const cropHeight = band?.height ?? Math.floor(height * 0.3);
  const line2Top = cropTop + Math.floor(cropHeight * 0.5);
  const line2Height = Math.max(cropHeight - Math.floor(cropHeight * 0.5), 40);
  const prefixWidth = Math.max(Math.floor(width * 0.46), 200);

  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("eng");

  try {
    const makeStrip = async (left: number, w: number) =>
      sharp(buffer)
        .extract({
          left,
          top: line2Top,
          width: Math.min(w, width - left),
          height: Math.min(line2Height, height - line2Top),
        })
        .resize({ width: Math.min(1600, Math.max(w * 2, 800)), withoutEnlargement: false })
        .greyscale()
        .normalize()
        .sharpen()
        .toBuffer();

    const [prefixImage, line2Image, prefixAltImage] = await Promise.all([
      makeStrip(0, prefixWidth),
      makeStrip(0, width),
      makeStrip(0, Math.floor(width * 0.55)),
    ]);

    await worker.setParameters({
      tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
      tessedit_pageseg_mode: PSM.SINGLE_LINE,
    });

    const [prefixText, line2Text, prefixAltText] = await Promise.all([
      worker.recognize(prefixImage).then((r) => r.data.text),
      worker.recognize(line2Image).then((r) => r.data.text),
      worker.recognize(prefixAltImage).then((r) => r.data.text),
    ]);

    return {
      prefixText: `${prefixText}\n${prefixAltText}`,
      line2Text,
      rawText: `${prefixText}\n${line2Text}\n${prefixAltText}`,
    };
  } finally {
    await worker.terminate();
  }
}

export function extractPassportNumberFromText(
  text: string,
  line2?: string | null,
  line1?: string | null,
): string | null {
  const candidates = collectPassportCandidates(text);

  if (line2 && isTruncatedLine2(line2)) {
    const compact = text.toUpperCase().replace(/[^A-Z0-9]/g, "");
    let best: { pass: string; score: number } | null = null;
    for (const candidate of candidates) {
      for (const variant of generatePassportVariants(candidate)) {
        const score = scorePassportCandidate(variant, line2, line1, compact, [text]);
        if (score < 0) continue;
        if (!best || score > best.score) {
          best = { pass: variant, score };
        }
      }
    }
    if (best) return best.pass;
  }

  const withCheck = text
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .match(KOR_PASSPORT_WITH_CHECK_RE);
  if (withCheck) {
    return withCheck[0].slice(0, 9);
  }

  return candidates[0] ?? null;
}
