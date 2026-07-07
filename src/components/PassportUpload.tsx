"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface PassportUploadProps {
  applicantId?: string;
  fullName?: string;
  redirectTo?: string;
}

export function PassportUpload({
  applicantId,
  fullName,
  redirectTo,
}: PassportUploadProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState(fullName ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("여권 이미지를 선택해 주세요.");
      return;
    }

    setLoading(true);
    setError(null);
    setProgress("업로드 및 분석 중... (최대 30초)");

    try {
      let targetId = applicantId;

      if (!targetId) {
        const createRes = await fetch("/api/applicants", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fullName: name || undefined, nationality: "VNM" }),
        });
        const createData = await createRes.json();
        if (!createRes.ok) {
          throw new Error(createData.error ?? "지원자 생성 실패");
        }
        targetId = createData.applicant.id;
      }

      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch(`/api/applicants/${targetId}/passport`, {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadRes.json();

      if (!uploadRes.ok) {
        throw new Error(uploadData.error ?? "여권 분석 실패");
      }

      router.push(redirectTo ?? `/applicants/${targetId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {!applicantId && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            지원자 이름 (선택)
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: NGUYEN VAN A"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          여권 이미지
        </label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
        />
        <p className="mt-2 text-xs text-slate-500">
          MRZ(하단 2줄)가 선명하게 보이는 사진을 업로드하세요. JPEG/PNG/WEBP, 최대 10MB.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {progress && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
          {progress}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "분석 중..." : "업로드 및 분석"}
      </button>
    </form>
  );
}
