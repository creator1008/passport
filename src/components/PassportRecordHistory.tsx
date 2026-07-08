"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateTime, recommendationLabel } from "@/lib/format";
import type { PassportRecord } from "@/lib/types";

interface PassportRecordHistoryProps {
  records: PassportRecord[];
  applicantId: string;
}

export function PassportRecordHistory({
  records,
  applicantId,
}: PassportRecordHistoryProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (records.length <= 1) {
    return null;
  }

  async function handleDelete(recordId: string) {
    const confirmed = window.confirm("이 등록 내역을 삭제하시겠습니까?");
    if (!confirmed) return;

    setDeletingId(recordId);
    try {
      const res = await fetch(`/api/passport-records/${recordId}`, {
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
      <h2 className="text-lg font-medium text-slate-900">등록 내역</h2>
      <p className="mt-1 text-sm text-slate-500">
        동일 여권번호는 최신 정보로 갱신됩니다. 불필요한 중복 내역은 삭제할 수 있습니다.
      </p>
      <ul className="mt-4 divide-y divide-slate-100">
        {records.map((record, index) => (
          <li
            key={record.id}
            className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
          >
            <div>
              <p className="font-medium text-slate-900">
                {record.passport_number || "여권번호 미확인"}
                {index === 0 && (
                  <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
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
