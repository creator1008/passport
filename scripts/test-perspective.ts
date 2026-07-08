import fs from "fs";
import { applyPerspectiveCorrection } from "../src/lib/passport/opencv-perspective";

const samplePath =
  "C:/Users/passi/.cursor/projects/d-Coding-Passport/assets/c__Users_passi_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_sample-1-6adbd5ce-6775-41b5-b55c-3da76aea9b47.png";

async function main() {
  const buffer = fs.readFileSync(samplePath);
  const result = await applyPerspectiveCorrection(buffer);
  console.log("applied:", result.applied, "size:", result.buffer.length);
  if (result.applied) {
    fs.writeFileSync("scripts/test-perspective-out.png", result.buffer);
  }
}

main().catch(console.error);
