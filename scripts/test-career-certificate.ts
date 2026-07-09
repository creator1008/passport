import { extractCareerCertificateFields, isCareerCertificateDocument } from "../src/lib/career-certificate/extract";
import { verifyCareerCertificate } from "../src/lib/career-certificate/verifier";

const sampleOcr = `
경 력 증 명 서

성    명 : 홍길동
생년월일 : 1990년 03월 15일
회 사 명 : (주)테스트컴퍼니
사업자등록번호 : 123-45-67890
소    속 : 개발팀
직    위 : 선임연구원
근 무 기 간 : 2020.01.01 ~ 2024.12.31
발 급 일 : 2025.01.10
발 급 처 : 인사팀
`;

console.log("isDocument:", isCareerCertificateDocument(sampleOcr));
const fields = extractCareerCertificateFields(sampleOcr);
console.log("fields:", JSON.stringify(fields, null, 2));

const verification = verifyCareerCertificate(fields, {
  score: 85,
  issues: [],
  width: 1200,
  height: 1600,
}, { usedGpt: false });
console.log("verification:", verification);
