import Link from "next/link";

export function SetupBanner() {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
      <h2 className="text-base font-semibold text-amber-900">Supabase 설정이 필요합니다</h2>
      <p className="mt-2 text-sm text-amber-800">
        `.env.example`을 `.env.local`로 복사한 뒤 Supabase 프로젝트 URL과 API 키를
        입력하세요. SQL은 `supabase/migrations/001_initial_schema.sql`을 실행합니다.
      </p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-amber-800">
        <li>
          <a
            className="underline"
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noreferrer"
          >
            Supabase
          </a>
          에서 프로젝트 생성
        </li>
        <li>SQL Editor에서 migration 파일 실행</li>
        <li>Storage에 `passports` 버킷 생성 (비공개)</li>
        <li>`.env.local` 설정 후 `npm run dev` 재시작</li>
      </ol>
    </div>
  );
}

export function AppHeader() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <div>
          <Link href="/" className="text-lg font-semibold text-slate-900">
            Passport Verify
          </Link>
          <p className="text-xs text-slate-500">외국인 채용 서류 검증 MVP · 베트남 여권</p>
        </div>
        <Link
          href="/applicants/new"
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          여권 등록
        </Link>
      </div>
    </header>
  );
}
