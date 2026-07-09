import type { CareerCertificateFields } from "@/lib/types";

const DOCUMENT_TYPE_KO: Record<string, string> = {
  "경력증명서": "경력증명서",
  "재직증명서": "재직증명서",
  "퇴직증명서": "퇴직증명서",
  "Career Certificate": "경력증명서",
  "Employment Certificate": "재직증명서",
  "Certificate of Employment": "재직증명서",
  "Work Certificate": "경력증명서",
};

function isMostlyKorean(text: string): boolean {
  const hangul = text.match(/[가-힣]/g)?.length ?? 0;
  const letters = text.match(/[A-Za-z가-힣]/g)?.length ?? 0;
  if (letters === 0) return false;
  return hangul / letters >= 0.25;
}

function localizeDocumentType(value: string | null): string | null {
  if (!value) return null;
  return DOCUMENT_TYPE_KO[value] ?? value;
}

function copyFieldsAsKorean(fields: CareerCertificateFields): CareerCertificateFields {
  return {
    ...fields,
    documentType: localizeDocumentType(fields.documentType),
    isCurrentlyEmployed: fields.isCurrentlyEmployed,
  };
}

async function translateWithOpenAi(
  fields: CareerCertificateFields,
  ocrText: string,
): Promise<CareerCertificateFields> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return copyFieldsAsKorean(fields);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Translate career/employment certificate fields into Korean. Return JSON with keys: documentType, employeeName, companyName, department, jobTitle, issuer. Keep date fields unchanged if provided separately. Use natural Korean. documentType should be one of: 경력증명서, 재직증명서, 퇴직증명서.",
        },
        {
          role: "user",
          content: JSON.stringify({ fields, ocrText: ocrText.slice(0, 3000) }),
        },
      ],
    }),
  });

  if (!response.ok) {
    return copyFieldsAsKorean(fields);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) return copyFieldsAsKorean(fields);

  try {
    const parsed = JSON.parse(content) as Partial<CareerCertificateFields>;
    return {
      documentType: parsed.documentType ?? localizeDocumentType(fields.documentType),
      employeeName: parsed.employeeName ?? fields.employeeName,
      dateOfBirth: fields.dateOfBirth,
      companyName: parsed.companyName ?? fields.companyName,
      businessNumber: fields.businessNumber,
      department: parsed.department ?? fields.department,
      jobTitle: parsed.jobTitle ?? fields.jobTitle,
      employmentStart: fields.employmentStart,
      employmentEnd: fields.employmentEnd,
      isCurrentlyEmployed: fields.isCurrentlyEmployed,
      issueDate: fields.issueDate,
      issuer: parsed.issuer ?? fields.issuer,
      certificateNumber: fields.certificateNumber,
      workHistory: fields.workHistory,
      careerSummary: fields.careerSummary,
      careerSummaryKo: fields.careerSummaryKo,
      companyAddress: fields.companyAddress,
      companyPhone: fields.companyPhone,
      representative: fields.representative,
      employmentYears: fields.employmentYears,
    };
  } catch {
    return copyFieldsAsKorean(fields);
  }
}

export async function translateCareerFieldsToKorean(
  fields: CareerCertificateFields,
  ocrText: string,
): Promise<CareerCertificateFields> {
  if (isMostlyKorean(ocrText)) {
    return copyFieldsAsKorean(fields);
  }
  return translateWithOpenAi(fields, ocrText);
}

export async function translateOcrTextToKorean(ocrText: string): Promise<string | null> {
  if (!ocrText.trim()) return null;
  if (isMostlyKorean(ocrText)) return ocrText.trim();

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "Translate the following employment/career certificate OCR text into Korean. Preserve structure and line breaks. Output only the translated text.",
        },
        { role: "user", content: ocrText.slice(0, 4000) },
      ],
    }),
  });

  if (!response.ok) return null;
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return payload.choices?.[0]?.message?.content?.trim() ?? null;
}
