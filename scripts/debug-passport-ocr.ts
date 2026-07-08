import fs from "fs";
import { parsePassportImage } from "../src/lib/passport/pipeline";
import { extractVisualFields } from "../src/lib/passport/visual-fields";

const samplePath =
  "C:/Users/passi/.cursor/projects/d-Coding-Passport/assets/c__Users_passi_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_samlpe-2-0624212f-0726-483c-85e2-7f2c91d25413.png";

async function main() {
  const buffer = fs.readFileSync(samplePath);
  const visual = await extractVisualFields(buffer, "1962-11-06", "2036-05-21");
  console.log("visual passport:", visual.passportNumber);
  console.log("visual raw (first 500):", visual.rawText.slice(0, 500));

  const result = await parsePassportImage(buffer, "image/png");
  console.log("final passport:", result.fields.passportNumber);
  console.log("passportOcr:", (result.rawExtraction as any).passportOcr);
}

main().catch(console.error);
