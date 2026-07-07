import { parse as parseMrz } from "mrz";
import type { PassportFields } from "@/lib/types";

function parseMrzDate(value: string | null | undefined): string | null {
  if (!value || value.length !== 6) {
    return null;
  }

  const yy = Number(value.slice(0, 2));
  const mm = value.slice(2, 4);
  const dd = value.slice(4, 6);

  const currentYear = new Date().getFullYear() % 100;
  const century = yy > currentYear + 10 ? 1900 : 2000;
  const year = century + yy;

  return `${year}-${mm}-${dd}`;
}

export function parseMrzLines(lines: string[]): {
  fields: PassportFields;
  raw: Record<string, unknown>;
} {
  const empty: PassportFields = {
    passportNumber: null,
    surname: null,
    givenNames: null,
    nationality: null,
    sex: null,
    dateOfBirth: null,
    dateOfIssue: null,
    dateOfExpiry: null,
    mrzLine1: lines[0] ?? null,
    mrzLine2: lines[1] ?? null,
    mrzValid: false,
  };

  if (lines.length < 2) {
    return { fields: empty, raw: { error: "MRZ lines not found" } };
  }

  try {
    const result = parseMrz(lines, { autocorrect: true });
    const fields = result.fields;

    return {
      fields: {
        passportNumber: fields.documentNumber ?? null,
        surname: fields.lastName ?? null,
        givenNames: fields.firstName ?? null,
        nationality: fields.nationality ?? fields.issuingState ?? null,
        sex: fields.sex ?? null,
        dateOfBirth: parseMrzDate(fields.birthDate),
        dateOfIssue: parseMrzDate(fields.issueDate),
        dateOfExpiry: parseMrzDate(fields.expirationDate),
        mrzLine1: lines[0],
        mrzLine2: lines[1],
        mrzValid: result.valid,
      },
      raw: {
        format: result.format,
        valid: result.valid,
        details: result.details,
        documentNumber: result.documentNumber,
      },
    };
  } catch (error) {
    return {
      fields: empty,
      raw: {
        error: error instanceof Error ? error.message : "MRZ parse failed",
      },
    };
  }
}
