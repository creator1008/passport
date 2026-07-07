import Link from "next/link";
import { AppHeader, SetupBanner } from "@/components/Layout";
import {
  formatDateTime,
  recommendationClass,
  recommendationLabel,
  statusLabel,
} from "@/lib/format";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/server";
import type { Applicant } from "@/lib/types";

interface ApplicantListItem extends Applicant {
  passport_records?: Array<{
    id: string;
    recommendation: string;
    confidence: number | null;
    created_at: string;
  }>;
}

async function getApplicants(): Promise<ApplicantListItem[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("applicants")
    .select("*, passport_records(id, recommendation, confidence, created_at)")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ApplicantListItem[];
}

export default async function HomePage() {
  const configured = isSupabaseConfigured();
  let applicants: ApplicantListItem[] = [];
  let error: string | null = null;

  if (configured) {
    try {
      applicants = await getApplicants();
    } catch (err) {
      error = err instanceof Error ? err.message : "데이터를 불러오지 못했습니다.";
    }
  }

  return (
    <div className="min-h-full bg-slate-50">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {!configured && <SetupBanner />}

        {configured && (
          <>
            <div className="mb-6 flex items-end justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">지원자 목록</h1>
                <p className="mt-1 text-sm text-slate-500">
                  업로드된 여권을 AI가 분석하고 심사 결과를 표시합니다.
                </p>
              </div>
              <p className="text-sm text-slate-500">총 {applicants.length}명</p>
            </div>

            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {applicants.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
                <p className="text-sm text-slate-600">등록된 지원자가 없습니다.</p>
                <Link
                  href="/applicants/new"
                  className="mt-4 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  첫 여권 등록하기
                </Link>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">이름</th>
                      <th className="px-4 py-3 font-medium">국적</th>
                      <th className="px-4 py-3 font-medium">상태</th>
                      <th className="px-4 py-3 font-medium">AI 판정</th>
                      <th className="px-4 py-3 font-medium">등록일</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {applicants.map((applicant) => {
                      const latest = applicant.passport_records?.sort(
                        (a, b) =>
                          new Date(b.created_at).getTime() -
                          new Date(a.created_at).getTime(),
                      )[0];

                      return (
                        <tr key={applicant.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <Link
                              href={`/applicants/${applicant.id}`}
                              className="font-medium text-blue-600 hover:underline"
                            >
                              {applicant.full_name || "이름 미확인"}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {applicant.nationality}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {statusLabel(applicant.status)}
                          </td>
                          <td className="px-4 py-3">
                            {latest ? (
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${recommendationClass(latest.recommendation)}`}
                              >
                                {recommendationLabel(latest.recommendation)}
                                {latest.confidence != null &&
                                  ` · ${Math.round(latest.confidence * 100)}%`}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {formatDateTime(applicant.created_at)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
