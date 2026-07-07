import { NextResponse } from "next/server";
import { parsePassportImage } from "@/lib/passport/pipeline";
import { uploadPassportImage } from "@/lib/storage";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const ALLOWED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

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
      { error: "JPEG, PNG, WEBP 이미지만 업로드할 수 있습니다." },
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
  const parseResult = await parsePassportImage(buffer, file.type);
  const storagePath = await uploadPassportImage(applicantId, buffer, file.type);

  const displayName =
    [parseResult.fields.surname, parseResult.fields.givenNames]
      .filter(Boolean)
      .join(" ")
      .trim() || applicant.full_name;

  const applicantStatus =
    parseResult.recommendation === "PASS"
      ? "APPROVED"
      : parseResult.recommendation === "FAIL"
        ? "REJECTED"
        : "REVIEW";

  const { data: passportRecord, error: insertError } = await supabase
    .from("passport_records")
    .insert({
      applicant_id: applicantId,
      passport_number: parseResult.fields.passportNumber,
      surname: parseResult.fields.surname,
      given_names: parseResult.fields.givenNames,
      nationality: parseResult.fields.nationality,
      sex: parseResult.fields.sex,
      date_of_birth: parseResult.fields.dateOfBirth,
      date_of_issue: parseResult.fields.dateOfIssue,
      date_of_expiry: parseResult.fields.dateOfExpiry,
      mrz_line1: parseResult.fields.mrzLine1,
      mrz_line2: parseResult.fields.mrzLine2,
      mrz_valid: parseResult.fields.mrzValid,
      quality_score: parseResult.quality.score,
      confidence: parseResult.confidence,
      recommendation: parseResult.recommendation,
      flags: parseResult.flags,
      storage_path: storagePath,
      raw_extraction: parseResult.rawExtraction,
      used_ai: parseResult.usedAi,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  await supabase
    .from("applicants")
    .update({
      full_name: displayName || applicant.full_name,
      status: applicantStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", applicantId);

  return NextResponse.json({
    passportRecord,
    parseResult,
  });
}
