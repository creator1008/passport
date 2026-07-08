import { parseMrzLines } from "../src/lib/passport/mrz-parser";
import { extractMrzBody, rebuildLine2 } from "../src/lib/passport/mrz-engine";

const lines = [
  "PPKORJEONG<<OKRAN<<<<<<<<<<<<<<<<<<<<<<<<<<<",
  "KOR6112147F36052112601954V22726582",
];

const withoutPassport = parseMrzLines(lines);
console.log("without passport recovery:");
console.log("  mrzLine2:", withoutPassport.fields.mrzLine2);

const body = extractMrzBody(lines[1]);
const rebuiltLine2 = body ? rebuildLine2("M022K2433", body) : lines[1];
const withPassport = parseMrzLines([lines[0], rebuiltLine2], {
  passportNumber: "M022K2433",
});
console.log("\nwith passport recovery:");
console.log("  mrzLine2:", withPassport.fields.mrzLine2);
console.log("  passportNumber:", withPassport.fields.passportNumber);
console.log("  mrzValid:", withPassport.fields.mrzValid);
