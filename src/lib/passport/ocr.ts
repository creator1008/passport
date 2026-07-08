import { createWorker, PSM } from "tesseract.js";
import { cleanMrzLine1Ocr } from "@/lib/passport/mrz-line";
import {
  hasCompleteLine2,
  isTruncatedLine2,
  KOR_PASSPORT_WITH_CHECK_RE,
  normalizeLine1,
  normalizeLine2,
} from "@/lib/passport/mrz-engine";
import { extractMrzRegion, extractMrzRegionAlt, extractMrzRegionWide } from "@/lib/passport/quality-check";

const MRZ_CHAR_WHITELIST = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<";

function isMrzLine1(line: string): boolean {
  return (
    line.length >= 28 &&
    /^P[A-Z0-9][A-Z]{3}[A-Z<]/.test(line) &&
    /<<[A-Z]/.test(line)
  );
}

function recoverLine2Prefix(line: string, compact: string): string {
  let normalized = normalizeLine2(line.replace(/[^A-Z0-9]/g, ""));
  if (/^M\d{3}[A-Z]\d{4}/.test(normalized)) {
    return normalized;
  }

  const passportMatch = compact.match(KOR_PASSPORT_WITH_CHECK_RE);
  const korIndex = normalized.search(/K[O0]R\d{6}/);

  if (/^K[O0]R/.test(normalized)) {
    const suffix = normalized.slice(3);
    if (passportMatch) {
      const anchored = compact.match(
        new RegExp(
          `${passportMatch[0].slice(0, 9)}\\dK[O0]R${suffix.slice(0, 12)}`,
        ),
      );
      if (anchored) {
        return normalizeLine2(anchored[0]);
      }
      return normalizeLine2(`${passportMatch[0]}KOR${suffix}`);
    }
  }

  if (passportMatch && korIndex >= 0) {
    return normalizeLine2(
      `${passportMatch[0]}KOR${normalized.slice(korIndex + 3)}`,
    );
  }

  const korAnchor = normalized.match(/K[O0]R\d{6}\d[MF]\d{6}[A-Z0-9]+/);
  if (korAnchor) {
    if (passportMatch) {
      return normalizeLine2(
        `${passportMatch[0]}KOR${korAnchor[0].slice(3)}`,
      );
    }
    return normalizeLine2(korAnchor[0]);
  }

  return normalized;
}

function isMrzLine2(line: string): boolean {
  const fixed = recoverLine2Prefix(line, line);
  if (fixed.length < 28) return false;
  return (
    /^[A-Z0-9]{8,9}\d[A-Z0-9]{3}\d{6}/.test(fixed) ||
    /^M\d{3}[A-Z]\d{4}\d?[A-Z]{3}\d{6}[MF]\d{6}/.test(fixed) ||
    /^KOR\d{6}[MF]\d{6}/.test(fixed)
  );
}

function extractLine1Candidate(compact: string): string | null {
  const match =
    compact.match(/P[A-Z0-9]KOR[A-Z]+<<[A-Z<]+/) ??
    compact.match(/P{1,2}KOR[A-Z<]{8,}/);
  if (!match) return null;
  const line = cleanMrzLine1Ocr(match[0]);
  return isMrzLine1(line) ? line : null;
}

function extractLine2Candidate(compact: string): string | null {
  const patterns = [
    /M\d{3}[A-Z]\d{4}\d?[A-Z0-9]{2,4}\d{6,7}[MF]\d{6}[A-Z0-9<]{8,}/,
    /[A-Z0-9]{8,9}\d[A-Z0-9]{2,4}\d{6,7}[MF]\d{6}[A-Z0-9<]{8,}/,
    /[A-Z0-9]{5,9}\d[A-Z0-9]{2,4}\d{5,7}[MF]\d{6}[A-Z0-9<]{6,}/,
  ];

  for (const pattern of patterns) {
    const match = compact.match(pattern);
    if (!match) continue;
    const line = normalizeLine2(match[0]);
    if (isMrzLine2(line)) {
      return line;
    }
  }

  const passportMatch = compact.match(
    new RegExp(`${KOR_PASSPORT_WITH_CHECK_RE.source}[A-Z0-9<]{20,}`),
  );
  if (passportMatch) {
    const line = normalizeLine2(passportMatch[0]);
    if (line.length >= 28) {
      return line;
    }
  }

  return null;
}

function splitMergedMrzText(text: string): string[] {
  const compact = text.toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9<]/g, "");
  const line2 = extractLine2Candidate(compact);
  if (!line2) {
    return [];
  }

  const line2Index = compact.indexOf(line2.slice(0, 12));
  const line1 =
    extractLine1Candidate(compact) ??
    (line2Index > 10 ? cleanMrzLine1Ocr(compact.slice(0, line2Index)) : null);

  if (!line1 || !isMrzLine1(line1) || !isMrzLine2(line2)) {
    if (isMrzLine2(line2)) {
      const recoveredLine1 = extractLine1Candidate(compact);
      if (recoveredLine1) {
        return [recoveredLine1, line2];
      }
    }
    return [];
  }

  return [line1, line2];
}

export function extractMrzLinesFromText(text: string): string[] {
  const compact = text.toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9<]/g, "");
  const rawLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const merged = splitMergedMrzText(text);
  if (merged.length === 2) {
    return [
      normalizeLine1(cleanMrzLine1Ocr(merged[0])),
      normalizeLine2(merged[1]),
    ];
  }

  const line1Candidates = rawLines
    .map((line) => cleanMrzLine1Ocr(line.replace(/\s+/g, "").toUpperCase()))
    .filter(isMrzLine1);

  const line2Candidates = rawLines
    .map((line) => recoverLine2Prefix(line, compact))
    .filter(isMrzLine2);

  if (line1Candidates.length > 0 && line2Candidates.length > 0) {
    return [
      normalizeLine1(line1Candidates[0]),
      normalizeLine2(recoverLine2Prefix(line2Candidates[0], compact)),
    ];
  }

  const allNormalized = rawLines.flatMap((line) => {
    const compact1 = cleanMrzLine1Ocr(
      line.toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9<]/g, ""),
    );
    const compact2 = normalizeLine2(
      line.toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9]/g, ""),
    );
    const results: string[] = [];
    if (isMrzLine1(compact1)) results.push(compact1);
    if (isMrzLine2(compact2)) results.push(compact2);
    return results;
  });

  const foundLine1 = allNormalized.find(isMrzLine1);
  const foundLine2 = allNormalized.find(isMrzLine2);

  if (foundLine1 && foundLine2) {
    return [
      normalizeLine1(foundLine1),
      normalizeLine2(foundLine2),
    ];
  }

  const fuzzyLine1 = extractLine1Candidate(compact);
  const fuzzyLine2 =
    extractLine2Candidate(compact) ??
    (rawLines.map((line) => recoverLine2Prefix(line, compact)).find(isMrzLine2) ?? null);
  if (fuzzyLine1 && fuzzyLine2) {
    return [
      normalizeLine1(fuzzyLine1),
      normalizeLine2(recoverLine2Prefix(fuzzyLine2, compact)),
    ];
  }

  if (foundLine1 && fuzzyLine2) {
    return [
      normalizeLine1(foundLine1),
      normalizeLine2(recoverLine2Prefix(fuzzyLine2, compact)),
    ];
  }

  if (foundLine1) {
    return [normalizeLine1(foundLine1)];
  }

  if (fuzzyLine2) {
    return [normalizeLine2(recoverLine2Prefix(fuzzyLine2, compact))];
  }

  return [];
}

async function recognizeLine(
  worker: Awaited<ReturnType<typeof createWorker>>,
  image: Buffer,
  mode: (typeof PSM)[keyof typeof PSM],
): Promise<string> {
  await worker.setParameters({
    tessedit_char_whitelist: MRZ_CHAR_WHITELIST,
    tessedit_pageseg_mode: mode,
  });
  const { data } = await worker.recognize(image);
  return data.text;
}

async function ocrRegion(buffer: Buffer): Promise<{ lines: string[]; rawText: string }> {
  const worker = await createWorker("eng");
  try {
    const runPass = async (angle: number) => {
      const rotated =
        angle === 0
          ? buffer
          : await import("sharp").then((m) =>
              m
                .default(buffer)
                .rotate(angle, { background: { r: 255, g: 255, b: 255 } })
                .toBuffer(),
            );

      const rotatedMeta = await import("sharp").then((m) =>
        m.default(rotated).metadata(),
      );
      const regionHeight = rotatedMeta.height ?? 0;
      const regionWidth = rotatedMeta.width ?? 0;

      let rawText = await recognizeLine(worker, rotated, PSM.SINGLE_BLOCK);
      let lines = extractMrzLinesFromText(rawText);

      if (lines.length < 2 && regionHeight > 80 && regionWidth > 80) {
        const sharp = (await import("sharp")).default;
        const splitAt = Math.floor(regionHeight * 0.52);
        const [line1Image, line2Image] = await Promise.all([
          sharp(rotated)
            .extract({ left: 0, top: 0, width: regionWidth, height: splitAt })
            .toBuffer(),
          sharp(rotated)
            .extract({
              left: 0,
              top: splitAt,
              width: regionWidth,
              height: regionHeight - splitAt,
            })
            .toBuffer(),
        ]);

        const [line1Text, line2Text] = await Promise.all([
          recognizeLine(worker, line1Image, PSM.SINGLE_LINE),
          recognizeLine(worker, line2Image, PSM.SINGLE_LINE),
        ]);

        const line2Meta = await sharp(line2Image).metadata();
        const line2Width = line2Meta.width ?? regionWidth;
        const prefixWidth = Math.max(Math.floor(line2Width * 0.44), 120);
        const line2PrefixImage = await sharp(line2Image)
          .extract({ left: 0, top: 0, width: prefixWidth, height: line2Meta.height ?? 1 })
          .toBuffer();
        const line2PrefixText = await recognizeLine(worker, line2PrefixImage, PSM.SINGLE_LINE);
        const restClean = normalizeLine2(line2Text.replace(/[^A-Z0-9]/g, ""));
        const mergedLine2Text = isTruncatedLine2(restClean)
          ? normalizeLine2(`${normalizeLine2(line2PrefixText)}${restClean}`)
          : line2Text;

        rawText = `${line1Text}\n${mergedLine2Text}`;
        lines = extractMrzLinesFromText(rawText);
      }

      return { lines, rawText, score: scoreMrzLines(lines) };
    };

    let best = await runPass(0);
    if (best.score < 4) {
      for (const angle of [-3, 3, -5, 5]) {
        const candidate = await runPass(angle);
        if (candidate.score > best.score) {
          best = candidate;
        }
      }
    }

    return best;
  } finally {
    await worker.terminate();
  }
}

function scoreMrzLines(lines: string[]): number {
  if (lines.length < 2) return lines.length;
  let score = 2;
  if (lines[0]?.includes("<<")) score += 1;
  if (/^M\d{3}[A-Z]\d{4}/.test(lines[1] ?? "")) score += 4;
  if (!hasCompleteLine2(lines[1] ?? "")) score -= 3;
  if (/^\d{6}$/.test(lines[1].slice(13, 19))) score += 1;
  if (/^[MF]$/.test(lines[1].slice(20, 21))) score += 1;
  return score;
}

export async function ocrMrzLines(buffer: Buffer): Promise<{
  lines: string[];
  rawText: string;
}> {
  const [primaryRegion, altRegion, wideRegion] = await Promise.all([
    extractMrzRegion(buffer),
    extractMrzRegionAlt(buffer),
    extractMrzRegionWide(buffer),
  ]);

  const [primary, alt, wide] = await Promise.all([
    ocrRegion(primaryRegion),
    ocrRegion(altRegion),
    ocrRegion(wideRegion),
  ]);

  const candidates = [primary, alt, wide];
  const best = candidates.reduce((winner, candidate) =>
    scoreMrzLines(candidate.lines) > scoreMrzLines(winner.lines)
      ? candidate
      : winner,
  );

  const compact = best.rawText.toUpperCase().replace(/[^A-Z0-9<]/g, "");

  if (best.lines[0]) {
    best.lines[0] = normalizeLine1(best.lines[0]);
  }
  if (best.lines[1]) {
    best.lines[1] = normalizeLine2(recoverLine2Prefix(best.lines[1], compact));
  }

  return best;
}
