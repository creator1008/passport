import { NextResponse } from "next/server";
import { parseCareerCertificateDocument } from "@/lib/career-certificate/pipeline";
import { upsertCareerCertificateRecord } from "@/lib/career-certificate/upsert";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export async function POST(request: Request, context: RouteContext) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured. Set .env.local first." },
      { status: 503 },
    );
  }

  const { id: applicantId } = await context.params;
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "JPEG, PNG, WEBP, PDF 파일만 업로드할 수 있습니다." },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdmin();
  const { data: applicant, error: applicantError } = await supabase
    .from("applicants")
    .select("id, full_name")
    .eq("id", applicantId)
    .single();

  if (applicantError || !applicant) {
    return NextResponse.json({ error: "Applicant not found" }, { status: 404 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const parseResult = await parseCareerCertificateDocument(buffer, file.type, {
    applicantName: applicant.full_name,
    filename: file.name,
  });

  try {
    const result = await upsertCareerCertificateRecord({
      applicantId,
      buffer,
      mimeType: file.type,
      parseResult,
    });

    return NextResponse.json({
      careerCertificateRecord: result.careerCertificateRecord,
      applicantId: result.applicantId,
      updated: result.updated,
      parseResult,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "저장 실패" },
      { status: 500 },
    );
  }
}
