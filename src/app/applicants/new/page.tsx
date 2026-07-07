import Link from "next/link";
import { AppHeader, SetupBanner } from "@/components/Layout";
import { PassportUpload } from "@/components/PassportUpload";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export default function NewApplicantPage() {
  const configured = isSupabaseConfigured();

  return (
    <div className="min-h-full bg-slate-50">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← 목록으로
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-slate-900">여권 등록</h1>
        <p className="mt-2 text-sm text-slate-500">
          여권 이미지를 업로드하면 MRZ 파싱, 품질 검사, 기본 적격성 검증을 수행합니다.
        </p>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
          {!configured ? <SetupBanner /> : <PassportUpload />}
        </div>
      </main>
    </div>
  );
}
