"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateTime, recommendationLabel } from "@/lib/format";
import type { CareerCertificateRecord } from "@/lib/types";

interface CareerCertificateRecordHistoryProps {
  records: CareerCertificateRecord[];
  applicantId: string;
}

export function CareerCertificateRecordHistory({
  records,
  applicantId,
}: CareerCertificateRecordHistoryProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (records.length <= 1) {
    return null;
  }

  async function handleDelete(recordId: string) {
    const confirmed = window.confirm("이 경력증명서 등록 내역을 삭제하시겠습니까?");
    if (!confirmed) return;

    setDeletingId(recordId);
    try {
      const res = await fetch(`/api/career-certificate-records/${recordId}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "삭제 실패");
      }

      if (data.applicantId !== applicantId) {
        router.push(`/applicants/${data.applicantId}`);
      }
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "삭제 중 오류가 발생했습니다.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-2">
      <h2 className="text-lg font-medium text-slate-900">경력증명서 등록 내역</h2>
      <ul className="mt-4 divide-y divide-slate-100">
        {records.map((record, index) => (
          <li
            key={record.id}
            className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
          >
            <div>
              <p className="font-medium text-slate-900">
                {record.company_name || "회사명 미확인"}
                {index === 0 && (
                  <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                    최신
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-slate-500">
                {formatDateTime(record.created_at)} ·{" "}
                {recommendationLabel(record.recommendation)}
                {record.confidence != null &&
                  ` · ${Math.round(record.confidence * 100)}%`}
              </p>
            </div>
            {index > 0 && (
              <button
                type="button"
                onClick={() => handleDelete(record.id)}
                disabled={deletingId === record.id}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                {deletingId === record.id ? "삭제 중..." : "삭제"}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
