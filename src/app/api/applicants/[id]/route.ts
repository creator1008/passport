import { NextResponse } from "next/server";
import { getPassportImageUrl, deletePassportImage } from "@/lib/storage";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/server";
import type { ApplicantStatus, ApplicantWithPassport } from "@/lib/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const VALID_STATUSES = new Set<ApplicantStatus>([
  "PENDING",
  "REVIEW",
  "APPROVED",
  "REJECTED",
]);

export async function GET(_request: Request, context: RouteContext) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured. Set .env.local first." },
      { status: 503 },
    );
  }

  const { id } = await context.params;
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("applicants")
    .select("*, passport_records(*)")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Applicant not found" }, { status: 404 });
  }

  const applicant = data as ApplicantWithPassport;
  const latestPassport = applicant.passport_records?.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )[0];

  let imageUrl: string | null = null;
  if (latestPassport?.storage_path) {
    imageUrl = await getPassportImageUrl(latestPassport.storage_path);
  }

  return NextResponse.json({
    applicant,
    latestPassport,
    imageUrl,
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured. Set .env.local first." },
      { status: 503 },
    );
  }

  const { id } = await context.params;
  const body = (await request.json()) as { status?: string };

  if (!body.status || !VALID_STATUSES.has(body.status as ApplicantStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("applicants")
    .update({
      status: body.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ applicant: data });
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

  const { data: records, error: fetchError } = await supabase
    .from("passport_records")
    .select("storage_path")
    .eq("applicant_id", id);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (records?.length) {
    await Promise.all(records.map((r) => deletePassportImage(r.storage_path)));
  }

  const { error } = await supabase.from("applicants").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
