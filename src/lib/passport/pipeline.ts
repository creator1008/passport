import { aiPassportFallback } from "@/lib/passport/ai-fallback";
import { normalizePassportImage } from "@/lib/passport/image-normalize";
import {
  hasCompleteLine2,
  isTruncatedLine2,
  parseMrz,
  rebuildLine2,
  resolvePassportFromSources,
  sanitizeIsoDate,
  toPassportFields,
} from "@/lib/passport/mrz-engine";
import { ocrMrzLines } from "@/lib/passport/ocr";
import { extractMrzLine2PrefixFromImage } from "@/lib/passport/passport-number";
import { checkImageQuality } from "@/lib/passport/quality-check";
import {
  extractPassportNumberFromImage,
  extractVisualFields,
} from "@/lib/passport/visual-fields";
import {
  shouldUseAiFallback,
  verifyPassport,
} from "@/lib/passport/verifier";
import type { ParseResult, PassportFields } from "@/lib/types";

function scoreLines(lines: string[]): number {
  if (lines.length < 2) return lines.length;
  let score = 2;
  if (lines[0]?.includes("<<")) score += 1;
  if (hasCompleteLine2(lines[1] ?? "")) score += 4;
  if (isTruncatedLine2(lines[1] ?? "")) score -= 3;
  return score;
}

export async function parsePassportImage(
  buffer: Buffer,
  mimeType: string,
): Promise<ParseResult> {
  const normalized = await normalizePassportImage(buffer);

  let workingBuffer = normalized.buffer;
  let ocr = await ocrMrzLines(workingBuffer);
  if (scoreLines(ocr.lines) < 4) {
    const fallback = await ocrMrzLines(buffer);
    if (scoreLines(fallback.lines) > scoreLines(ocr.lines)) {
      ocr = fallback;
      workingBuffer = buffer;
    }
  }

  const quality = await checkImageQuality(workingBuffer);
  const line2Raw = ocr.lines[1] ?? "";
  const needsRecovery =
    isTruncatedLine2(line2Raw) || !hasCompleteLine2(line2Raw);

  const textSources: string[] = [ocr.rawText];
  let passportHint: string | null = null;

  if (needsRecovery) {
    const [prefixOcr, passportOcr] = await Promise.all([
      extractMrzLine2PrefixFromImage(workingBuffer),
      extractPassportNumberFromImage(workingBuffer, line2Raw),
    ]);
    textSources.push(
      prefixOcr.rawText,
      prefixOcr.prefixText,
      prefixOcr.line2Text,
      passportOcr.rawText,
    );
    passportHint = passportOcr.passportNumber;
  }

  let parsed = parseMrz(ocr.lines, passportHint);
  let fields: PassportFields = toPassportFields(parsed);

  const rawExtraction: Record<string, unknown> = {
    quality,
    imageNormalization: normalized.corrections,
    ocrText: ocr.rawText,
    mrzLines: ocr.lines,
    engine: "mrz-engine",
    parse: parsed,
  };

  if (
    needsRecovery &&
    parsed.body &&
    parsed.line1 &&
    (!fields.passportNumber || !parsed.hasCompleteLine2)
  ) {
    const visual = await extractVisualFields(
      workingBuffer,
      fields.dateOfBirth,
      fields.dateOfExpiry,
    );
    textSources.push(visual.rawText);
    rawExtraction.visualOcr = visual.rawText;

    const passport =
      resolvePassportFromSources(
        line2Raw,
        parsed.line1,
        ...textSources,
      ) ??
      visual.passportNumber ??
      passportHint;

    if (passport && !passport.startsWith("KOR")) {
      const rebuiltLine2 = rebuildLine2(passport, parsed.body);
      parsed = parseMrz([parsed.line1, rebuiltLine2], passport);
      fields = toPassportFields(parsed);
    }
  }

  if (!fields.dateOfIssue) {
    const visual = await extractVisualFields(
      workingBuffer,
      fields.dateOfBirth,
      fields.dateOfExpiry,
    );
    if (!rawExtraction.visualOcr) rawExtraction.visualOcr = visual.rawText;
    if (visual.dateOfIssue) {
      fields = { ...fields, dateOfIssue: sanitizeIsoDate(visual.dateOfIssue) };
      if (visual.inferred) rawExtraction.issueDateInferred = true;
    }
  }

  rawExtraction.mrzLines = [fields.mrzLine1, fields.mrzLine2];

  let usedAi = false;
  let verification = verifyPassport(fields, quality);

  if (rawExtraction.issueDateInferred) {
    verification = {
      ...verification,
      flags: [
        ...verification.flags,
        {
          code: "ISSUE_DATE_INFERRED",
          severity: "LOW" as const,
          message:
            "발급일을 시각 영역에서 읽지 못해 만료일 기준 10년 역산으로 추정했습니다.",
        },
      ],
    };
  }

  if (shouldUseAiFallback(verification.confidence, verification.flags)) {
    const ai = await aiPassportFallback(
      workingBuffer.toString("base64"),
      mimeType,
      fields,
    );
    fields = ai.fields;
    rawExtraction.ai = ai.raw;
    usedAi = true;
    verification = verifyPassport(fields, quality);
  }

  return {
    fields,
    quality,
    flags: verification.flags,
    confidence: verification.confidence,
    recommendation: verification.recommendation,
    rawExtraction,
    usedAi,
  };
}
