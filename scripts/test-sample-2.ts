import fs from "fs";
import { parseMrzLines } from "../src/lib/passport/mrz-parser";
import { resolvePassportFromTruncatedLine2 } from "../src/lib/passport/passport-number";
import { parsePassportImage } from "../src/lib/passport/pipeline";

const truncatedLines = [
  "PPKORJANG<<MOONOK<<<<<<<<<<<<<<<<<<<<<<<<<<<",
  "KOR6211062M36052112720897V27780318",
];

console.log("=== Truncated MRZ (user report) ===");
const resolved = resolvePassportFromTruncatedLine2(
  truncatedLines[1],
  truncatedLines[0],
  "M515N6463",
  "Passport No M515N6463",
);
console.log("resolved from fuzzy visual:", resolved);

if (resolved) {
  const parsed = parseMrzLines(truncatedLines, { passportNumber: resolved });
  console.log("passport:", parsed.fields.passportNumber);
  console.log("mrzLine2:", parsed.fields.mrzLine2);
  console.log("mrzValid:", parsed.fields.mrzValid);
}

async function main() {
  const samplePath =
    "C:/Users/passi/.cursor/projects/d-Coding-Passport/assets/c__Users_passi_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_samlpe-2-0624212f-0726-483c-85e2-7f2c91d25413.png";

  console.log("\n=== Full image parse ===");
  const buffer = fs.readFileSync(samplePath);
  const result = await parsePassportImage(buffer, "image/png");
  console.log("recommendation:", result.recommendation);
  console.log("flags:", result.flags.map((f) => f.code).join(", ") || "(none)");
  console.log("passport:", result.fields.passportNumber);
  console.log("mrzLine2:", result.fields.mrzLine2);
  console.log("mrzValid:", result.fields.mrzValid);
}

main().catch(console.error);
