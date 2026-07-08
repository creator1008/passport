import { parse as parseMrz } from "mrz";
import { computeMrzCheckDigit } from "../src/lib/passport/mrz-engine";

const line1 = "PPKORJANG<<MOONOK<<<<<<<<<<<<<<<<<<<<<<<<<<<";
for (const pass of ["M515N6463", "M515N6469", "M575N6463"]) {
  const check = String(computeMrzCheckDigit(pass));
  const line2 = `${pass}${check}KOR6211062M36052112720897V27780318`;
  const result = parseMrz([line1, line2.slice(0, 44)], { autocorrect: false });
  console.log(pass, "check", check, "valid", result.valid);
}
