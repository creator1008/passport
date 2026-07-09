import { extractCareerCertificateWithGpt } from "@/lib/career-certificate/ai-extract";
import { checkCareerCertificateQuality } from "@/lib/career-certificate/quality";
import { verifyCareerCertificate } from "@/lib/career-certificate/verifier";
import type { CareerCertificateParseResult } from "@/lib/types";

export async function parseCareerCertificateDocument(
  buffer: Buffer,
  mimeType: string,
  options?: { applicantName?: string | null; filename?: string },
): Promise<CareerCertificateParseResult> {
  const quality = await checkCareerCertificateQuality(buffer, mimeType);

  const gpt = await extractCareerCertificateWithGpt(buffer, mimeType, {
    applicantName: options?.applicantName,
    filename: options?.filename,
  });

  const rawExtraction: Record<string, unknown> = {
    quality,
    engine: "career-certificate-gpt-file",
    sourceMimeType: mimeType,
    gpt: gpt.raw,
    aiConfidence: gpt.aiConfidence,
  };

  const verification = verifyCareerCertificate(gpt.fields, quality, {
    applicantName: options?.applicantName,
    isDocument: gpt.isEmploymentDocument,
    usedGpt: true,
    aiConfidence: gpt.aiConfidence,
  });

  return {
    fields: gpt.fields,
    fieldsKo: gpt.fieldsKo,
    quality,
    flags: verification.flags,
    confidence: verification.confidence,
    recommendation: verification.recommendation,
    rawExtraction,
    usedAi: true,
    sourceMimeType: mimeType,
  };
}

/** @deprecated use parseCareerCertificateDocument */
export const parseCareerCertificateImage = parseCareerCertificateDocument;
