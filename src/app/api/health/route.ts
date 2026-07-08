import { NextResponse } from "next/server";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/server";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { status: "error", message: "Supabase not configured" },
      { status: 503 },
    );
  }

  try {
    const supabase = getSupabaseAdmin();
    const [applicants, storage] = await Promise.all([
      supabase.from("applicants").select("id", { count: "exact", head: true }),
      supabase.storage.from("passports").list("", { limit: 1 }),
    ]);

    if (applicants.error) {
      throw new Error(applicants.error.message);
    }
    if (storage.error) {
      throw new Error(storage.error.message);
    }

    return NextResponse.json({
      status: "ok",
      database: true,
      storage: true,
      applicantCount: applicants.count ?? 0,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Health check failed",
      },
      { status: 500 },
    );
  }
}
