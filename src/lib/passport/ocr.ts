import { createWorker, PSM } from "tesseract.js";
import { extractMrzRegion } from "@/lib/passport/quality-check";

const MRZ_CHAR_WHITELIST = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<";

function normalizeMrzLine(line: string): string {
  return line
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9<]/g, "<")
    .replace(/<{2,}/g, "<");
}

export function extractMrzLinesFromText(text: string): string[] {
  const candidates = text
    .split(/\r?\n/)
    .map(normalizeMrzLine)
    .filter((line) => line.length >= 30 && line.includes("<"));

  const td3Pairs: string[] = [];

  for (let i = 0; i < candidates.length - 1; i += 1) {
    const line1 = padMrzLine(candidates[i], 44);
    const line2 = padMrzLine(candidates[i + 1], 44);

    if (line1.startsWith("P<") || line1.startsWith("P")) {
      td3Pairs.push(line1, line2);
      break;
    }
  }

  if (td3Pairs.length === 2) {
    return td3Pairs;
  }

  const longest = [...candidates].sort((a, b) => b.length - a.length);
  if (longest.length >= 2) {
    return [padMrzLine(longest[0], 44), padMrzLine(longest[1], 44)];
  }

  return longest.slice(0, 2).map((line) => padMrzLine(line, 44));
}

function padMrzLine(line: string, length: number): string {
  if (line.length >= length) {
    return line.slice(0, length);
  }
  return line.padEnd(length, "<");
}

export async function ocrMrzLines(buffer: Buffer): Promise<{
  lines: string[];
  rawText: string;
}> {
  const mrzRegion = await extractMrzRegion(buffer);

  const worker = await createWorker("eng");
  try {
    await worker.setParameters({
      tessedit_char_whitelist: MRZ_CHAR_WHITELIST,
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
    });

    const { data } = await worker.recognize(mrzRegion);
    const lines = extractMrzLinesFromText(data.text);

    return {
      lines,
      rawText: data.text,
    };
  } finally {
    await worker.terminate();
  }
}
