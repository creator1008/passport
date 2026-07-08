import { parseMrz, toPassportFields } from "../src/lib/passport/mrz-engine";

const userCase = [
  "PPORJEBERRRR<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<",
  "M022K2433R12147F36052112601954V22726582",
];

const exact = [
  "PPKORJEONG<<OKRAN<<<<<<<<<<<<<<<<<<<<<<<<<<<",
  "M022K24332KOR6112147F36052112601954V22726582",
];

const truncated = [
  "PPKORJANG<<MOONOK<<<<<<<<<<<<<<<<<<<<<<<<<<<",
  "KOR6211062M36052112720897V27780318",
];

function run(label: string, lines: string[]) {
  const result = parseMrz(lines);
  const fields = toPassportFields(result);
  console.log(`\n=== ${label} ===`);
  console.log("passport:", fields.passportNumber);
  console.log("surname:", fields.surname);
  console.log("dob:", fields.dateOfBirth);
  console.log("expiry:", fields.dateOfExpiry);
  console.log("issue:", fields.dateOfIssue);
  console.log("mrzValid:", fields.mrzValid);
  console.log("checksumValid:", result.checksumValid);
  console.log("dobRecovered:", result.dobRecovered);
  console.log("line2Reconstructed:", result.line2Reconstructed);
  console.log("line2:", fields.mrzLine2);
}

run("User corrupted OCR", userCase);
run("Exact JEONG OKRAN", exact);
run("Truncated JANG", truncated);
