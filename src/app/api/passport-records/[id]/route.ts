import { NextResponse } from "next/server";
import { deletePassportImage } from "@/lib/storage";
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
    .from("passport_records")
    .select("id, storage_path, applicant_id")
    .eq("id", id)
    .single();

  if (fetchError || !record) {
    return NextResponse.json({ error: "Passport record not found" }, { status: 404 });
  }

  await deletePassportImage(record.storage_path);

  const { error } = await supabase.from("passport_records").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { count } = await supabase
    .from("passport_records")
    .select("id", { count: "exact", head: true })
    .eq("applicant_id", record.applicant_id);

  if (!count) {
    await supabase
      .from("applicants")
      .update({ status: "PENDING", updated_at: new Date().toISOString() })
      .eq("id", record.applicant_id);
  }

  return NextResponse.json({ success: true, applicantId: record.applicant_id });
}
