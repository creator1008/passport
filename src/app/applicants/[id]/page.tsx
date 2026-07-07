import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/Layout";
import { PassportUpload } from "@/components/PassportUpload";
import {
  formatDate,
  formatDateTime,
  recommendationClass,
  recommendationLabel,
  severityClass,
  statusLabel,
} from "@/lib/format";
import { getPassportImageUrl } from "@/lib/storage";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/server";
import type { ApplicantWithPassport, PassportRecord, VerificationFlag } from "@/lib/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getApplicant(id: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("applicants")
    .select("*, passport_records(*)")
    .eq("id", id)
    .single();

  if (error || !data) {
    return null;
  }

  return data as ApplicantWithPassport;
}

function FieldRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid grid-cols-3 gap-2 border-b border-slate-100 py-2.5 text-sm last:border-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="col-span-2 font-medium text-slate-900">{value || "-"}</dd>
    </div>
  );
}

export default async function ApplicantDetailPage({ params }: PageProps) {
  if (!isSupabaseConfigured()) {
    notFound();
  }

  const { id } = await params;
  const applicant = await getApplicant(id);

  if (!applicant) {
    notFound();
  }

  const passports = (applicant.passport_records ?? []).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const latest = passports[0] as PassportRecord | undefined;
  const imageUrl = latest ? await getPassportImageUrl(latest.storage_path) : null;
  const flags = (latest?.flags ?? []) as VerificationFlag[];

  return (
    <div className="min-h-full bg-slate-50">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← 목록으로
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {applicant.full_name || "이름 미확인"}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              국적 {applicant.nationality} · 상태 {statusLabel(applicant.status)} · 등록{" "}
              {formatDateTime(applicant.created_at)}
            </p>
          </div>

          {latest && (
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-sm font-medium ${recommendationClass(latest.recommendation)}`}
            >
              AI 판정: {recommendationLabel(latest.recommendation)}
              {latest.confidence != null && ` (${Math.round(latest.confidence * 100)}%)`}
            </span>
          )}
        </div>

        {!latest ? (
          <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-medium text-slate-900">여권 업로드</h2>
            <p className="mt-1 text-sm text-slate-500">아직 등록된 여권이 없습니다.</p>
            <div className="mt-4">
              <PassportUpload applicantId={applicant.id} fullName={applicant.full_name ?? ""} />
            </div>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-medium text-slate-900">여권 이미지</h2>
              {imageUrl ? (
                <div className="relative mt-4 aspect-[3/2] overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                  <Image
                    src={imageUrl}
                    alt="Passport"
                    fill
                    className="object-contain"
                    unoptimized
                  />
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">이미지를 불러올 수 없습니다.</p>
              )}

              <dl className="mt-6">
                <FieldRow label="품질 점수" value={`${latest.quality_score ?? "-"} / 100`} />
                <FieldRow
                  label="MRZ 유효"
                  value={latest.mrz_valid ? "유효" : "무효/미확인"}
                />
                <FieldRow label="AI 보조" value={latest.used_ai ? "사용됨" : "미사용"} />
              </dl>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-medium text-slate-900">추출된 정보</h2>
              <dl className="mt-4">
                <FieldRow label="여권번호" value={latest.passport_number} />
                <FieldRow label="성" value={latest.surname} />
                <FieldRow label="이름" value={latest.given_names} />
                <FieldRow label="국적" value={latest.nationality} />
                <FieldRow label="성별" value={latest.sex} />
                <FieldRow label="생년월일" value={formatDate(latest.date_of_birth)} />
                <FieldRow label="발급일" value={formatDate(latest.date_of_issue)} />
                <FieldRow label="만료일" value={formatDate(latest.date_of_expiry)} />
              </dl>

              <div className="mt-6">
                <h3 className="text-sm font-medium text-slate-700">MRZ</h3>
                <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
                  {latest.mrz_line1}
                  {"\n"}
                  {latest.mrz_line2}
                </pre>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-2">
              <h2 className="text-lg font-medium text-slate-900">검증 플래그</h2>
              {flags.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">특이 사항이 없습니다.</p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {flags.map((flag) => (
                    <li
                      key={`${flag.code}-${flag.message}`}
                      className={`rounded-lg border px-3 py-2 text-sm ${severityClass(flag.severity)}`}
                    >
                      <span className="font-medium">{flag.code}</span>
                      <span className="mx-2">·</span>
                      {flag.message}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-2">
              <h2 className="text-lg font-medium text-slate-900">재업로드</h2>
              <p className="mt-1 text-sm text-slate-500">
                더 선명한 이미지로 다시 분석할 수 있습니다.
              </p>
              <div className="mt-4">
                <PassportUpload applicantId={applicant.id} fullName={applicant.full_name ?? ""} />
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
