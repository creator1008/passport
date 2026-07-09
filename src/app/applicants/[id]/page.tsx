import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CareerCertificateFieldsPanel,
  CareerCertificatePreview,
} from "@/components/CareerCertificateFieldsPanel";
import { CareerCertificateRecordHistory } from "@/components/CareerCertificateRecordHistory";
import { CareerCertificateUpload } from "@/components/CareerCertificateUpload";
import { AppHeader } from "@/components/Layout";
import { DeleteApplicantButton } from "@/components/DeleteApplicantButton";
import { PassportUpload } from "@/components/PassportUpload";
import { PassportRecordHistory } from "@/components/PassportRecordHistory";
import { ReviewActions } from "@/components/ReviewActions";
import {
  formatDate,
  formatDateTime,
  recommendationClass,
  recommendationLabel,
  severityClass,
  statusLabel,
} from "@/lib/format";
import { getCareerCertificateImageUrl, getPassportImageUrl } from "@/lib/storage";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/server";
import type {
  ApplicantWithDocuments,
  CareerCertificateRecord,
  PassportRecord,
  VerificationFlag,
} from "@/lib/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getApplicant(id: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("applicants")
    .select("*, passport_records(*), career_certificate_records(*)")
    .eq("id", id)
    .single();

  if (error || !data) {
    return null;
  }

  return data as ApplicantWithDocuments;
}

function FieldRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid grid-cols-3 gap-2 border-b border-slate-100 py-2.5 text-sm last:border-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="col-span-2 font-medium text-slate-900">{value || "-"}</dd>
    </div>
  );
}

function FlagList({ flags }: { flags: VerificationFlag[] }) {
  if (flags.length === 0) {
    return <p className="mt-3 text-sm text-slate-500">특이 사항이 없습니다.</p>;
  }

  return (
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
  const careerCerts = (applicant.career_certificate_records ?? []).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const latestPassport = passports[0] as PassportRecord | undefined;
  const latestCareer = careerCerts[0] as CareerCertificateRecord | undefined;

  const passportImageUrl = latestPassport
    ? await getPassportImageUrl(latestPassport.storage_path)
    : null;
  const careerImageUrl = latestCareer
    ? await getCareerCertificateImageUrl(latestCareer.storage_path)
    : null;

  const passportFlags = (latestPassport?.flags ?? []) as VerificationFlag[];
  const careerFlags = (latestCareer?.flags ?? []) as VerificationFlag[];

  const primaryRecommendation = latestPassport?.recommendation ?? latestCareer?.recommendation;
  const primaryConfidence = latestPassport?.confidence ?? latestCareer?.confidence;

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

          {primaryRecommendation && (
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-sm font-medium ${recommendationClass(primaryRecommendation)}`}
            >
              AI 판정: {recommendationLabel(primaryRecommendation)}
              {primaryConfidence != null && ` (${Math.round(primaryConfidence * 100)}%)`}
            </span>
          )}
          <DeleteApplicantButton
            applicantId={applicant.id}
            applicantName={applicant.full_name}
            variant="detail"
          />
        </div>

        {/* Passport section */}
        <section className="mt-8">
          <h2 className="text-xl font-semibold text-slate-900">여권</h2>

          {!latestPassport ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-6">
              <p className="text-sm text-slate-500">아직 등록된 여권이 없습니다.</p>
              <div className="mt-4">
                <PassportUpload applicantId={applicant.id} fullName={applicant.full_name ?? ""} />
              </div>
            </div>
          ) : (
            <div className="mt-4 grid gap-6 lg:grid-cols-2">
              <section className="rounded-xl border border-slate-200 bg-white p-6">
                <h3 className="text-lg font-medium text-slate-900">여권 이미지</h3>
                {passportImageUrl ? (
                  <div className="relative mt-4 aspect-[3/2] overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                    <Image
                      src={passportImageUrl}
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
                  <FieldRow label="품질 점수" value={`${latestPassport.quality_score ?? "-"} / 100`} />
                  <FieldRow
                    label="MRZ 유효"
                    value={latestPassport.mrz_valid ? "유효" : "무효/미확인"}
                  />
                  <FieldRow label="AI 보조" value={latestPassport.used_ai ? "사용됨" : "미사용"} />
                </dl>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-6">
                <h3 className="text-lg font-medium text-slate-900">추출된 정보</h3>
                <dl className="mt-4">
                  <FieldRow label="여권번호" value={latestPassport.passport_number} />
                  <FieldRow label="성" value={latestPassport.surname} />
                  <FieldRow label="이름" value={latestPassport.given_names} />
                  <FieldRow label="국적" value={latestPassport.nationality} />
                  <FieldRow label="성별" value={latestPassport.sex} />
                  <FieldRow label="생년월일" value={formatDate(latestPassport.date_of_birth)} />
                  <FieldRow label="발급일" value={formatDate(latestPassport.date_of_issue)} />
                  <FieldRow label="만료일" value={formatDate(latestPassport.date_of_expiry)} />
                </dl>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-2">
                <h3 className="text-lg font-medium text-slate-900">여권 검증 플래그</h3>
                <FlagList flags={passportFlags} />
              </section>

              <PassportRecordHistory records={passports} applicantId={applicant.id} />

              <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-2">
                <h3 className="text-lg font-medium text-slate-900">여권 재업로드</h3>
                <div className="mt-4">
                  <PassportUpload applicantId={applicant.id} fullName={applicant.full_name ?? ""} />
                </div>
              </section>
            </div>
          )}
        </section>

        {/* Career certificate section */}
        <section className="mt-10">
          <h2 className="text-xl font-semibold text-slate-900">경력증명서</h2>

          {!latestCareer ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-6">
              <p className="text-sm text-slate-500">아직 등록된 경력증명서가 없습니다.</p>
              <div className="mt-4">
                <CareerCertificateUpload applicantId={applicant.id} />
              </div>
            </div>
          ) : (
            <div className="mt-4 grid gap-6 lg:grid-cols-2">
              <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-medium text-slate-900">
                    {latestCareer.source_mime_type?.includes("pdf") ? "경력증명서 PDF" : "경력증명서 이미지"}
                  </h3>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${recommendationClass(latestCareer.recommendation)}`}
                  >
                    {recommendationLabel(latestCareer.recommendation)}
                  </span>
                </div>
                <CareerCertificatePreview
                  url={careerImageUrl}
                  mimeType={latestCareer.source_mime_type}
                />
                <dl className="mt-6">
                  <FieldRow label="파일 형식" value={latestCareer.source_mime_type ?? "-"} />
                  <FieldRow label="품질 점수" value={`${latestCareer.quality_score ?? "-"} / 100`} />
                  <FieldRow label="AI 보조" value={latestCareer.used_ai ? "사용됨" : "미사용"} />
                  <FieldRow
                    label="신뢰도"
                    value={
                      latestCareer.confidence != null
                        ? `${Math.round(latestCareer.confidence * 100)}%`
                        : "-"
                    }
                  />
                </dl>
              </section>

              <CareerCertificateFieldsPanel record={latestCareer} />

              <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-2">
                <h3 className="text-lg font-medium text-slate-900">경력증명서 검증 플래그</h3>
                <FlagList flags={careerFlags} />
              </section>

              <CareerCertificateRecordHistory records={careerCerts} applicantId={applicant.id} />

              <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-2">
                <h3 className="text-lg font-medium text-slate-900">경력증명서 재업로드</h3>
                <div className="mt-4">
                  <CareerCertificateUpload applicantId={applicant.id} />
                </div>
              </section>
            </div>
          )}
        </section>

        <section className="mt-10">
          <ReviewActions applicantId={applicant.id} currentStatus={applicant.status} />
        </section>
      </main>
    </div>
  );
}
