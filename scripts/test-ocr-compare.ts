import fs from "fs";
import { applyPerspectiveCorrection } from "../src/lib/passport/opencv-perspective";
import { normalizePassportImage } from "../src/lib/passport/image-normalize";
import { ocrMrzLines } from "../src/lib/passport/ocr";
import { parseMrzLines } from "../src/lib/passport/mrz-parser";

async function main() {
  const samplePath =
    "C:/Users/passi/.cursor/projects/d-Coding-Passport/assets/c__Users_passi_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_sample-1-6adbd5ce-6775-41b5-b55c-3da76aea9b47.png";

  const original = fs.readFileSync(samplePath);
  const perspective = await applyPerspectiveCorrection(original);
  const normalized = await normalizePassportImage(original);

  for (const [label, buffer] of [
    ["perspective", perspective.buffer],
    ["normalized", normalized.buffer],
  ] as const) {
    const ocr = await ocrMrzLines(buffer);
    const parsed = parseMrzLines(ocr.lines);
    console.log(`--- ${label} ---`);
    console.log("lines:", ocr.lines);
    console.log("passport:", parsed.fields.passportNumber);
    console.log("name:", parsed.fields.surname, parsed.fields.givenNames);
  }
}

main().catch(console.error);
