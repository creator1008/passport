import Image from "next/image";
import { formatDate } from "@/lib/format";
import type {
  CareerCertificateFields,
  CareerCertificateFieldsKo,
  CareerCertificateRecord,
  WorkExperienceEntry,
} from "@/lib/types";

function FieldRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid grid-cols-3 gap-2 border-b border-slate-100 py-2.5 text-sm last:border-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="col-span-2 font-medium text-slate-900">{value || "-"}</dd>
    </div>
  );
}

function formatYears(years: number | null | undefined): string | null {
  if (years == null || Number.isNaN(years)) return null;
  return `${years}년`;
}

function fieldsFromRecord(record: CareerCertificateRecord): CareerCertificateFields {
  return {
    documentType: record.document_type,
    employeeName: record.employee_name,
    dateOfBirth: record.date_of_birth,
    companyName: record.company_name,
    companyAddress: record.company_address ?? null,
    companyPhone: record.company_phone ?? null,
    representative: record.representative ?? null,
    businessNumber: record.business_number,
    department: record.department,
    jobTitle: record.job_title,
    employmentStart: record.employment_start,
    employmentEnd: record.employment_end,
    employmentYears: record.employment_years ?? null,
    isCurrentlyEmployed: record.is_currently_employed,
    issueDate: record.issue_date,
    issuer: record.issuer,
    certificateNumber: record.certificate_number,
    workHistory: record.work_history ?? [],
    careerSummary: record.career_summary,
    careerSummaryKo: record.career_summary_ko,
  };
}

function WorkHistoryCard({
  entry,
  index,
  korean,
}: {
  entry: WorkExperienceEntry;
  index: number;
  korean?: boolean;
}) {
  const company = korean ? entry.companyNameKo ?? entry.companyName : entry.companyName;
  const address = korean
    ? entry.companyAddressKo ?? entry.companyAddress
    : entry.companyAddress;
  const representative = korean
    ? entry.representativeKo ?? entry.representative
    : entry.representative;
  const jobTitle = korean ? entry.jobTitleKo ?? entry.jobTitle : entry.jobTitle;
  const department = korean ? entry.departmentKo ?? entry.department : entry.department;
  const duration = korean
    ? entry.durationLabelKo ??
      [
        formatDate(entry.employmentStart),
        entry.isCurrentlyEmployed ? "재직중" : formatDate(entry.employmentEnd),
      ]
        .filter((v) => v && v !== "-")
        .join(" ~ ")
    : entry.durationLabel ??
      [
        formatDate(entry.employmentStart),
        entry.isCurrentlyEmployed ? "Present" : formatDate(entry.employmentEnd),
      ]
        .filter((v) => v && v !== "-")
        .join(" ~ ");
  const responsibilities = korean
    ? entry.responsibilitiesKo ?? entry.responsibilities
    : entry.responsibilities;

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-medium text-slate-900">
          {index + 1}. {company || "회사명 미확인"}
        </h4>
        <span className="shrink-0 text-xs text-slate-500">{duration || "-"}</span>
      </div>
      {(jobTitle || department) && (
        <p className="mt-1 text-sm text-slate-600">
          {[department, jobTitle].filter(Boolean).join(" · ")}
        </p>
      )}
      {entry.employmentYears != null && (
        <p className="mt-1 text-xs text-slate-500">근무년수: {formatYears(entry.employmentYears)}</p>
      )}
      {address && <p className="mt-1 text-xs text-slate-500">주소: {address}</p>}
      {entry.companyPhone && (
        <p className="mt-1 text-xs text-slate-500">전화: {entry.companyPhone}</p>
      )}
      {representative && (
        <p className="mt-1 text-xs text-slate-500">대표자: {representative}</p>
      )}
      {entry.location && !address && (
        <p className="mt-1 text-xs text-slate-500">{entry.location}</p>
      )}
      {responsibilities && (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
          {responsibilities}
        </p>
      )}
    </article>
  );
}

function WorkHistoryList({
  entries,
  korean,
}: {
  entries: WorkExperienceEntry[];
  korean?: boolean;
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-slate-500">추출된 근무 이력이 없습니다.</p>;
  }

  return (
    <div className="space-y-3">
      {entries.map((entry, index) => (
        <WorkHistoryCard key={`${entry.companyName}-${index}`} entry={entry} index={index} korean={korean} />
      ))}
    </div>
  );
}

function SummaryBlock({ title, text }: { title: string; text: string | null | undefined }) {
  if (!text) return null;
  return (
    <div className="mt-4">
      <h4 className="text-sm font-medium text-slate-700">{title}</h4>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{text}</p>
    </div>
  );
}

interface CareerCertificatePreviewProps {
  url: string | null;
  mimeType: string | null;
}

export function CareerCertificatePreview({ url, mimeType }: CareerCertificatePreviewProps) {
  if (!url) {
    return <p className="mt-4 text-sm text-slate-500">파일을 불러올 수 없습니다.</p>;
  }

  const isPdf = mimeType?.includes("pdf") || url.toLowerCase().includes(".pdf");

  if (isPdf) {
    return (
      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
        <iframe src={url} title="Career certificate PDF" className="h-[560px] w-full" />
        <div className="border-t border-slate-200 bg-white px-3 py-2 text-right">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-emerald-700 hover:underline"
          >
            PDF 새 창에서 열기
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mt-4 aspect-[3/4] overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
      <Image src={url} alt="Career certificate" fill className="object-contain" unoptimized />
    </div>
  );
}

interface CareerCertificateFieldsPanelProps {
  record: CareerCertificateRecord;
}

export function CareerCertificateFieldsPanel({ record }: CareerCertificateFieldsPanelProps) {
  const original = fieldsFromRecord(record);
  const korean: CareerCertificateFieldsKo | null = record.fields_ko;
  const workHistory = original.workHistory.length > 0 ? original.workHistory : [];

  return (
    <>
      <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-2">
        <h3 className="text-lg font-medium text-slate-900">근무 이력 (원본)</h3>
        <div className="mt-4">
          <WorkHistoryList entries={workHistory} />
        </div>
        <SummaryBlock title="경력 요약" text={original.careerSummary} />
      </section>

      <section className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-6 lg:col-span-2">
        <h3 className="text-lg font-medium text-emerald-900">근무 이력 (한국어 번역)</h3>
        <div className="mt-4">
          <WorkHistoryList entries={workHistory} korean />
        </div>
        <SummaryBlock
          title="경력 요약 (한국어)"
          text={original.careerSummaryKo ?? korean?.careerSummary}
        />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="text-lg font-medium text-slate-900">인적·회사 정보 (원본)</h3>
        <dl className="mt-4">
          <FieldRow label="성명" value={original.employeeName} />
          <FieldRow label="생년월일" value={formatDate(original.dateOfBirth)} />
          <FieldRow label="문서 유형" value={original.documentType} />
          <FieldRow label="회사명" value={original.companyName} />
          <FieldRow label="회사주소" value={original.companyAddress} />
          <FieldRow label="회사전화" value={original.companyPhone} />
          <FieldRow label="대표자" value={original.representative} />
          <FieldRow label="직책" value={original.jobTitle} />
          <FieldRow label="근무기간" value={[formatDate(original.employmentStart), original.isCurrentlyEmployed ? "재직중" : formatDate(original.employmentEnd)].filter((v) => v && v !== "-").join(" ~ ") || null} />
          <FieldRow label="근무년수" value={formatYears(original.employmentYears)} />
          <FieldRow label="발급일" value={formatDate(original.issueDate)} />
        </dl>
      </section>

      <section className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-6">
        <h3 className="text-lg font-medium text-emerald-900">인적·회사 정보 (한국어)</h3>
        <dl className="mt-4">
          <FieldRow label="성명" value={korean?.employeeName ?? original.employeeName} />
          <FieldRow label="문서 유형" value={korean?.documentType ?? original.documentType} />
          <FieldRow label="회사명" value={korean?.companyName ?? original.companyName} />
          <FieldRow label="회사주소" value={korean?.companyAddress ?? original.companyAddress} />
          <FieldRow label="대표자" value={korean?.representative ?? original.representative} />
          <FieldRow label="직책" value={korean?.jobTitle ?? original.jobTitle} />
          <FieldRow label="발급처" value={korean?.issuer ?? original.issuer} />
          <FieldRow label="발급일" value={formatDate(original.issueDate)} />
        </dl>
      </section>
    </>
  );
}
