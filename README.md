# DeskKit Studio — Dual-Product Landing & Free SEO Calculators

구독료 0원 평생소장 로컬-퍼스트 웹앱 **SoloDesk Studio v1.0** & **StayDesk Pro v1.0** 공식 랜딩페이지 및 무료 SEO 유틸리티 허브입니다.

## 포함된 구성
- `index.html`: 반응형 KR/EN 전환 랜딩페이지 + 인터랙티브 무료 계산기 2종
  1. **프리랜서 3.3% 원천징수 · 부가세 10% 정산/역산 & 한글금액 계산기** (`SoloDesk Lite`)
  2. **에어비앤비·공유숙박 순수익(P&L) · 청소 원가 · 손익분기 계산기** (`StayDesk Lite`)
- `assets/`: 두 제품 KR/EN 실사 UI 스크린샷 13종 (SoloDesk 5종 + StayDesk KR 4종 + StayDesk EN 4종) + 1200×630 OpenGraph 소셜 공유 커버 (`og-cover.png`)
- `robots.txt` / `sitemap.xml`: 검색 색인용 기본 파일

## 1분 공개 배포 체크리스트 (화면 잠금 해제 후)
1. `index.html` 상단 `CONFIG` 객체에 라이브된 Gumroad / 크몽 URL 입력
2. GitHub 로그인(Google OAuth) → 신규 Public 레포 생성 (예: `deskkit-studio` 또는 `<username>.github.io`)
3. 본 폴더(`/Users/agent/mission/landing`) 커밋 & 푸시 → Settings → Pages → `main / root` 활성화
4. `sitemap.xml`의 `<loc>`를 실제 GitHub Pages URL로 업데이트
5. 디스콰이엇 / 긱뉴스 / 프리랜서·숙박 호스트 커뮤니티에 "무료 3.3%·숙소 순수익 계산기"로 자연 유입 공유
