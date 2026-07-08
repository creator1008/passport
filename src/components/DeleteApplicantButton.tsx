"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface DeleteApplicantButtonProps {
  applicantId: string;
  applicantName?: string | null;
  redirectTo?: string;
  variant?: "list" | "detail";
}

export function DeleteApplicantButton({
  applicantId,
  applicantName,
  redirectTo = "/",
  variant = "list",
}: DeleteApplicantButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    const label = applicantName || "이 지원자";
    const confirmed = window.confirm(
      `${label}의 등록 내역을 삭제하시겠습니까?\n여권 이미지와 분석 결과가 모두 삭제됩니다.`,
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/applicants/${applicantId}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "삭제 실패");
      }

      router.push(redirectTo);
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "삭제 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  const className =
    variant === "detail"
      ? "rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
      : "rounded-lg px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50";

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={loading}
      className={className}
    >
      {loading ? "삭제 중..." : "삭제"}
    </button>
  );
}
