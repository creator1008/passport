# Passport Verify (MVP)

베트남 여권·경력증명서를 업로드하면 MRZ/OCR·GPT 분석, 품질 검사, 적격성 검증을 수행하고 결과를 Supabase에 저장합니다.

**웹 앱 주소:** GitHub Pages(`github.io`)가 아니라 **Vercel 등 Node 호스팅**에 배포해야 합니다.  
저장소 루트의 `index.html`은 Pages 접속 시 README 대신 배포 안내를 보여 줍니다.

## 기능

- 여권 이미지 업로드 (JPEG/PNG/WEBP)
- MRZ 파싱 + Tesseract OCR
- 경력증명서 PDF/이미지 업로드 + GPT-4o-mini Structured Outputs 추출
- 이미지 품질 검사, 만료일·체크섬·논리 오류 검증
- 지원자 목록 / 서류 상세 화면

## 시작하기 (로컬)

### 1. Supabase

1. [Supabase](https://supabase.com/dashboard)에서 프로젝트 생성
2. SQL Editor에서 `supabase/migrations/` 아래 마이그레이션을 순서대로 실행
3. Storage 버킷 `passports`, `career-certificates` 확인

### 2. 환경 변수

```bash
cp .env.example .env.local
```

`.env.local` 예시:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
OPENAI_API_KEY=sk-...
```

### 3. 실행

```bash
npm install
npm run dev
```

http://localhost:3000

## 웹 배포 (Vercel 권장)

이 프로젝트는 **API 라우트와 서버 렌더링**이 필요합니다. GitHub Pages만으로는 앱이 실행되지 않습니다.

### Vercel 원클릭 배포

1. [Vercel — 이 저장소 Import](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fcreator1008%2Fpassport)
2. 환경 변수 입력: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`
3. Deploy 후 나온 URL(예: `https://passport-verify.vercel.app`)을 GitHub 저장소 **About → Website**에 등록

### GitHub Pages 정리 (선택)

Settings → Pages에서 Pages를 **Disabled**로 두면 `github.io`로 README만 보이는 혼란을 줄일 수 있습니다.  
Pages를 유지한다면 루트 `index.html`의 `PRODUCTION_URL`에 Vercel 주소를 넣어 리다이렉트할 수 있습니다.

## 아키텍처

```
Next.js App
├── /api/applicants                    지원자 CRUD
├── /api/applicants/[id]/passport      여권 업로드 + 파싱
├── /api/applicants/[id]/career-certificate  경력증명서 GPT 추출
├── lib/passport/                      MRZ 엔진, OCR, 검증
├── lib/career-certificate/            GPT 파일 업로드, Structured Outputs
└── Supabase                           PostgreSQL + Storage
```

## 비용 (MVP)

| 항목 | 비용 |
|------|------|
| Supabase Free | $0 |
| MRZ + Tesseract | $0 (서버에서 실행) |
| OpenAI (경력증명서 등) | 사용량 기준 |
| Vercel Hobby | $0 |
