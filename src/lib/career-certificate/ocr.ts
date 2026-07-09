import { createWorker, PSM } from "tesseract.js";
import { preprocessForOcr } from "@/lib/career-certificate/quality";

export async function ocrCareerCertificate(buffer: Buffer): Promise<string> {
  const preprocessed = await preprocessForOcr(buffer);
  const worker = await createWorker("kor+eng");

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
      preserve_interword_spaces: "1",
    });

    const { data } = await worker.recognize(preprocessed);
    return data.text ?? "";
  } finally {
    await worker.terminate();
  }
}
