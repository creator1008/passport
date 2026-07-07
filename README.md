# Passport Verify (MVP)

베트남 여권 이미지를 업로드하면 MRZ 파싱, 이미지 품질 검사, 기본 적격성 검증을 수행하고 결과를 Supabase에 저장합니다.

## 기능

- 여권 이미지 업로드 (JPEG/PNG/WEBP)
- MRZ 파싱 + Tesseract OCR (로컬, 비용 $0)
- 이미지 품질 검사 (해상도, 대비, 밝기)
- 만료일·체크섬·논리 오류 검증
- (선택) OpenAI GPT-4o-mini AI 보조 추출
- 지원자 목록 / 여권 상세 화면

## 시작하기

### 1. Supabase 프로젝트 생성

1. [Supabase](https://supabase.com/dashboard)에서 새 프로젝트 생성
2. SQL Editor에서 `supabase/migrations/001_initial_schema.sql` 실행
3. Storage → `passports` 버킷이 생성되었는지 확인 (비공개)

### 2. 환경 변수

```bash
cp .env.example .env.local
```

`.env.local`에 다음 값을 입력:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
OPENAI_API_KEY=sk-...   # 선택
```

### 3. 실행

```bash
npm install
npm run dev
```

브라우저에서 http://localhost:3000 접속

## 아키텍처 (MVP)

```
Next.js App
├── /api/applicants          지원자 CRUD
├── /api/applicants/[id]/passport  업로드 + 파싱
├── lib/passport/
│   ├── quality-check.ts     Sharp 품질 검사
│   ├── ocr.ts               Tesseract MRZ OCR
│   ├── mrz-parser.ts        MRZ 체크섬 파싱
│   ├── verifier.ts          규칙 기반 검증
│   ├── ai-fallback.ts       (선택) GPT-4o-mini
│   └── pipeline.ts          파이프라인 오케스트레이션
└── Supabase
    ├── PostgreSQL           applicants, passport_records
    └── Storage              passports 버킷
```

## 비용 (MVP)

| 항목 | 비용 |
|------|------|
| Supabase Free | $0 |
| MRZ + Tesseract | $0 (로컬) |
| OpenAI (30% 건만 호출 시) | ~$0.01/건 |
| Vercel Hobby | $0 |

## 다음 단계

- [ ] Supabase Auth (기업 사용자 로그인)
- [ ] 경력증명서, 학력증명서 추가
- [ ] Worker 분리 (비동기 Queue)
- [ ] Cloud OCR 전환
