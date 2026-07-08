import fs from "fs";
import { parseKoreanMrz } from "../src/lib/passport/korean-mrz";
import { parsePassportImage } from "../src/lib/passport/pipeline";

const exact1 = [
  "PPKORJEONG<<OKRAN<<<<<<<<<<<<<<<<<<<<<<<<<<<",
  "M022K24332KOR6112147F36052112601954V22726582",
];

const truncated = [
  "PPKORJANG<<MOONOK<<<<<<<<<<<<<<<<<<<<<<<<<<<",
  "KOR6211062M36052112720897V27780318",
];

const corrupted = [
  "PPKORJEONG<<OKRAN<<<<<<<<<<<<<<<<<<<<<<<<<<<",
  "R112147F36052112601954V22726582",
];

console.log("=== Exact JEONG OKRAN ===");
console.log(JSON.stringify(parseKoreanMrz(exact1), null, 2));

console.log("\n=== Truncated JANG ===");
console.log(JSON.stringify(parseKoreanMrz(truncated), null, 2));

console.log("\n=== Corrupted prefix ===");
console.log(JSON.stringify(parseKoreanMrz(corrupted), null, 2));

async function main() {
  const path =
    "C:/Users/passi/.cursor/projects/d-Coding-Passport/assets/c__Users_passi_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_sample-1-a5ebd721-9ba2-45fa-bced-077d6aa22b60.png";
  const result = await parsePassportImage(fs.readFileSync(path), "image/png");
  console.log("\n=== Image parse ===");
  console.log("flags:", result.flags.map((f) => f.code).join(", ") || "(none)");
  console.log(JSON.stringify(result.fields, null, 2));
}

main().catch(console.error);
