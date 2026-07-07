import { NextResponse } from "next/server";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/server";
import type { Applicant } from "@/lib/types";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured. Set .env.local first." },
      { status: 503 },
    );
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("applicants")
    .select("*, passport_records(id, recommendation, confidence, created_at)")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ applicants: data as Applicant[] });
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured. Set .env.local first." },
      { status: 503 },
    );
  }

  const body = (await request.json()) as { fullName?: string; nationality?: string };
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("applicants")
    .insert({
      full_name: body.fullName?.trim() || null,
      nationality: body.nationality?.trim() || "VNM",
      status: "PENDING",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ applicant: data as Applicant }, { status: 201 });
}
