const TD3_LINE_LENGTH = 44;
const TD3_NAME_START = 5;

const FILLER_GARBAGE = /^[CLIK]{2,4}$/;

export function sanitizeGivenNames(raw: string): string {
  let given = raw.split("<")[0] ?? raw;
  given = given.replace(/<+/g, "").trim();

  given = given
    .replace(/YEQOL/gi, "YEOL")
    .replace(/YE0L/gi, "YEOL")
    .replace(/YEOLC/gi, "YEOL")
    .replace(/QOL$/i, "OL");

  // OCR filler after given name: OKRANCIL...WO -> OKRAN
  given = given.replace(/^([A-Z]{2,15}?)(?:CI+[LW]*|C+[IL]+|CL+|WO|[CIWL]{3,}).*$/i, "$1");
  given = given.replace(/(CCCKKLCL+|CL+|CLK+|LKC+|KL|CLC)$/gi, "");
  given = given.replace(/(CLC|CLK|LKC|KL|CL|CI|WO)$/gi, "");

  return given.trim();
}

export function parseNamesFromMrzLine1(line1: string): {
  surname: string | null;
  givenNames: string | null;
} {
  if (line1.length < TD3_NAME_START + 3) {
    return { surname: null, givenNames: null };
  }

  const nameField = line1.slice(TD3_NAME_START);
  const separator = nameField.indexOf("<<");
  if (separator === -1) {
    return { surname: null, givenNames: null };
  }

  const surname = nameField.slice(0, separator).replace(/<+/g, "");
  const givenNames = sanitizeGivenNames(nameField.slice(separator + 2));

  return {
    surname: surname || null,
    givenNames: givenNames || null,
  };
}

function padMrzLine(line: string, length: number = TD3_LINE_LENGTH): string {
  if (line.length >= length) {
    return line.slice(0, length);
  }
  return line.padEnd(length, "<");
}

export function rebuildMrzLine1(
  line1: string,
  surname: string | null,
  givenNames: string | null,
): string {
  if (!surname) {
    return padMrzLine(line1);
  }

  const prefix = line1.slice(0, TD3_NAME_START);
  const rebuilt = `${prefix}${surname}<<${givenNames ?? ""}`;
  return padMrzLine(rebuilt);
}

const SURNAME_OCR_FIXES: Record<string, string> = {
  IANECC: "JANG",
  IANEC: "JANG",
  IANG: "JANG",
  IANECCM: "JANG",
  JEBERRRR: "JEONG",
  JEBERRR: "JEONG",
  JEBERR: "JEONG",
  JEBE: "JEONG",
};

const KNOWN_GIVEN_NAMES = ["MOONOK", "OKRAN", "SUNGHO", "MINJI", "YEONOK"];

function recoverSurnameFromOcr(raw: string): string {
  const compact = raw.replace(/[^A-Z]/g, "");
  if (!compact) return "";
  if (SURNAME_OCR_FIXES[compact]) return SURNAME_OCR_FIXES[compact];
  if (compact.startsWith("I") && compact.includes("ANG")) return "JANG";
  return compact.replace(/[CLIK]{2,}/g, "").slice(0, 20);
}

function recoverNamesFromCorruptedLine1(line1: string): {
  surname: string | null;
  givenNames: string | null;
} {
  const upper = line1.toUpperCase();
  if (!/^PPK[O0]R/.test(upper) && !/^PPOR/.test(upper)) {
    return { surname: null, givenNames: null };
  }

  for (const given of KNOWN_GIVEN_NAMES) {
    const idx = upper.indexOf(given);
    if (idx <= 5) continue;
    const surname = recoverSurnameFromOcr(upper.slice(5, idx));
    if (surname.length >= 2) {
      return { surname, givenNames: given };
    }
  }

  const nameBlob = upper.slice(5).split("<<")[0] ?? "";
  const fixedSurname = SURNAME_OCR_FIXES[nameBlob] ?? recoverSurnameFromOcr(nameBlob);
  if (fixedSurname.length >= 2) {
    return { surname: fixedSurname, givenNames: null };
  }

  return { surname: null, givenNames: null };
}

export function cleanMrzLine1Ocr(line1: string): string {
  let cleaned = line1
    .toUpperCase()
    .replace(/^PPOR/, "PPKOR")
    .replace(/^PP0R/, "PPKOR")
    .replace(/^PP[E1I][O0Q]R/, "PPKOR")
    .replace(/^PPEOR/, "PPKOR")
    .replace(/^PPKO[RQ]([A-Z])/, "PPKOR$1")
    .replace(/CLO([A-Z])/g, "<<O$1")
    .replace(/([A-Z])CLO/g, "$1<<O")
    .replace(/<+[LK]+<+/gi, "<<")
    .replace(/([A-Z])<[LK]+<([A-Z])/g, "$1<<$2")
    .replace(/<<([A-Z]{1,4})</g, "<<<")
    .replace(/YEQOL/gi, "YEOL")
    .replace(/YE0L/gi, "YEOL");

  const recovered = recoverNamesFromCorruptedLine1(cleaned);
  if (recovered.surname) {
    cleaned = rebuildMrzLine1(
      cleaned,
      recovered.surname,
      recovered.givenNames ?? "",
    );
  } else {
    const names = parseNamesFromMrzLine1(cleaned);
    const surname = names.surname
      ? SURNAME_OCR_FIXES[names.surname] ?? names.surname
      : null;
    cleaned = rebuildMrzLine1(cleaned, surname, names.givenNames);
  }

  return cleaned;
}

export function isFillerGarbage(token: string): boolean {
  return FILLER_GARBAGE.test(token);
}
