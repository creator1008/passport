import type { PassportFields } from "@/lib/types";

interface AiPassportResponse {
  passportNumber?: string | null;
  surname?: string | null;
  givenNames?: string | null;
  nationality?: string | null;
  sex?: string | null;
  dateOfBirth?: string | null;
  dateOfIssue?: string | null;
  dateOfExpiry?: string | null;
}

export async function aiPassportFallback(
  imageBase64: string,
  mimeType: string,
  currentFields: PassportFields,
): Promise<{ fields: PassportFields; raw: Record<string, unknown> }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { fields: currentFields, raw: { skipped: "OPENAI_API_KEY not set" } };
  }

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
            "You extract passport fields from images. Return JSON only with keys: passportNumber, surname, givenNames, nationality, sex, dateOfBirth, dateOfIssue, dateOfExpiry. Dates must be YYYY-MM-DD. Use null if unknown.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Current partial extraction: ${JSON.stringify(currentFields)}. Fill missing or correct fields.`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
                detail: "low",
              },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return {
      fields: currentFields,
      raw: { error: `OpenAI API error: ${response.status}`, detail: errorText },
    };
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    return { fields: currentFields, raw: { error: "Empty AI response" } };
  }

  try {
    const parsed = JSON.parse(content) as AiPassportResponse;
    const merged: PassportFields = {
      ...currentFields,
      passportNumber: parsed.passportNumber ?? currentFields.passportNumber,
      surname: parsed.surname ?? currentFields.surname,
      givenNames: parsed.givenNames ?? currentFields.givenNames,
      nationality: parsed.nationality ?? currentFields.nationality,
      sex: parsed.sex ?? currentFields.sex,
      dateOfBirth: parsed.dateOfBirth ?? currentFields.dateOfBirth,
      dateOfIssue: parsed.dateOfIssue ?? currentFields.dateOfIssue,
      dateOfExpiry: parsed.dateOfExpiry ?? currentFields.dateOfExpiry,
    };

    return { fields: merged, raw: { ai: parsed } };
  } catch {
    return { fields: currentFields, raw: { error: "Invalid AI JSON", content } };
  }
}
