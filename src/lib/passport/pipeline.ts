import { aiPassportFallback } from "@/lib/passport/ai-fallback";
import { parseMrzLines } from "@/lib/passport/mrz-parser";
import { ocrMrzLines } from "@/lib/passport/ocr";
import { checkImageQuality } from "@/lib/passport/quality-check";
import {
  shouldUseAiFallback,
  verifyPassport,
} from "@/lib/passport/verifier";
import type { ParseResult } from "@/lib/types";

export async function parsePassportImage(
  buffer: Buffer,
  mimeType: string,
): Promise<ParseResult> {
  const quality = await checkImageQuality(buffer);
  const ocr = await ocrMrzLines(buffer);
  const mrz = parseMrzLines(ocr.lines);

  let fields = mrz.fields;
  let usedAi = false;
  const rawExtraction: Record<string, unknown> = {
    quality,
    ocrText: ocr.rawText,
    mrzLines: ocr.lines,
    mrzParse: mrz.raw,
  };

  let verification = verifyPassport(fields, quality);

  if (shouldUseAiFallback(verification.confidence, verification.flags)) {
    const base64 = buffer.toString("base64");
    const ai = await aiPassportFallback(base64, mimeType, fields);
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
