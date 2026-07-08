"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { statusLabel } from "@/lib/format";
import type { ApplicantStatus } from "@/lib/types";

interface ReviewActionsProps {
  applicantId: string;
  currentStatus: ApplicantStatus;
}

const ACTIONS: Array<{
  status: ApplicantStatus;
  label: string;
  className: string;
}> = [
  {
    status: "APPROVED",
    label: "승인",
    className: "bg-emerald-600 hover:bg-emerald-700 text-white",
  },
  {
    status: "REVIEW",
    label: "심사 보류",
    className: "bg-amber-500 hover:bg-amber-600 text-white",
  },
  {
    status: "REJECTED",
    label: "반려",
    className: "bg-red-600 hover:bg-red-700 text-white",
  },
];

export function ReviewActions({ applicantId, currentStatus }: ReviewActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<ApplicantStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function updateStatus(status: ApplicantStatus) {
    setLoading(status);
    setError(null);

    try {
      const res = await fetch(`/api/applicants/${applicantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "상태 변경 실패");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-medium text-slate-900">심사관 판정</h2>
      <p className="mt-1 text-sm text-slate-500">
        현재 상태: <span className="font-medium">{statusLabel(currentStatus)}</span>
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {ACTIONS.map((action) => (
          <button
            key={action.status}
            type="button"
            disabled={loading !== null || currentStatus === action.status}
            onClick={() => updateStatus(action.status)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${action.className}`}
          >
            {loading === action.status ? "처리 중..." : action.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
