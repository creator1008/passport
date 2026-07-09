import { NextResponse } from "next/server";
import { deleteCareerCertificateImage } from "@/lib/storage";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: Request, context: RouteContext) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured. Set .env.local first." },
      { status: 503 },
    );
  }

  const { id } = await context.params;
  const supabase = getSupabaseAdmin();

  const { data: record, error: fetchError } = await supabase
    .from("career_certificate_records")
    .select("id, storage_path, applicant_id")
    .eq("id", id)
    .single();

  if (fetchError || !record) {
    return NextResponse.json({ error: "Career certificate record not found" }, { status: 404 });
  }

  await deleteCareerCertificateImage(record.storage_path);

  const { error } = await supabase
    .from("career_certificate_records")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, applicantId: record.applicant_id });
}
