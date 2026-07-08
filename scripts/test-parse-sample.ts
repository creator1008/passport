import fs from "fs";
import { parsePassportImage } from "../src/lib/passport/pipeline";

async function main() {
  const samplePath =
    "C:/Users/passi/.cursor/projects/d-Coding-Passport/assets/c__Users_passi_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_sample-1-6adbd5ce-6775-41b5-b55c-3da76aea9b47.png";

  const buffer = fs.readFileSync(samplePath);
  const result = await parsePassportImage(buffer, "image/png");

  console.log("recommendation:", result.recommendation);
  console.log("confidence:", result.confidence);
  console.log("fields:", JSON.stringify(result.fields, null, 2));
  console.log("normalization:", result.rawExtraction?.imageNormalization);
  console.log("mrz lines:", result.rawExtraction?.mrzLines);
}

main().catch(console.error);
