import fs from "fs";
import { parsePassportImage } from "../src/lib/passport/pipeline";

const path =
  "C:/Users/passi/.cursor/projects/d-Coding-Passport/assets/c__Users_passi_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_sample-1-a5ebd721-9ba2-45fa-bced-077d6aa22b60.png";

async function main() {
  const result = await parsePassportImage(fs.readFileSync(path), "image/png");
  console.log("flags:", result.flags.map((f) => f.code).join(", "));
  console.log(JSON.stringify(result.fields, null, 2));
  console.log("mrzLines:", result.rawExtraction?.mrzLines);
}

main().catch(console.error);
