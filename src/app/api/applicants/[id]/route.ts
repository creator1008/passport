import { NextResponse } from "next/server";
import { getPassportImageUrl } from "@/lib/storage";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/server";
import type { ApplicantWithPassport } from "@/lib/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

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
