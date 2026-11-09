# 📍 CareRoute (케어루트)

**케어루트**는 방문 요양보호사와 사회복지사를 위한 **방문 일정·어르신 명단 관리 Android 앱 및 웹 애플리케이션(PWA)** 입니다.

현재 버전은 **v1.40.1**이며, Android 앱은 버전 코드 **18**입니다. Android 설치·Google 캘린더 인증·권한 및 서명 빌드는 [ANDROID.md](ANDROID.md), 버전별 변경사항은 [CHANGELOG.md](CHANGELOG.md)를 참고하세요. 태그와 릴리즈 설명은 [GitHub Releases](https://github.com/LeeAn0121/CareRoute/releases)에 기록하며, AAB 파일은 로컬에서만 생성하고 GitHub에는 업로드하지 않습니다.

Google 로그인이 필요하며, 서버에서 확인한 계정의 데이터만 조회·수정합니다. 새 데이터는 생성한 계정에 귀속됩니다. 기존 공용 데이터는 `public.legacy_data_access`의 활성 이메일에만 공유됩니다. 이 허용 목록은 Supabase Table Editor/SQL Editor의 관리자 권한으로 수정하며 앱에서는 수정할 수 없습니다. 초기 허용 계정은 `jggen0121@naver.com`, `jggen0401@gmail.com`, `jggen4177@gmail.com`입니다. 사진·PDF는 비공개 버킷에서 권한을 확인한 만료 링크로 엽니다.

이전 버전은 로그인 없이 데이터에 접근하므로 더 이상 운영 DB에 접근할 수 없습니다. 설치 앱은 새 AAB로 업데이트해야 합니다. 계정 전환 시 명단·일지 초안·임시 기록·정렬 순서·캘린더 토큰을 섞지 않으며, 계정 없는 옛 캐시는 자동으로 가져오지 않습니다. 앱 재실행 시 로그인 검증에는 네트워크가 필요합니다.

Android 7.0 이상 및 Chromium 기반 WebView 111 이상을 실행 기준으로 사용합니다. 작은 화면·폴더블·분할 화면·태블릿·큰 글씨·화면 회전 조건으로 검증하며, 모든 제조사·기종의 실기기 검증을 완료했다는 의미는 아닙니다. 오래된 WebView에서는 업데이트 안내가 표시됩니다.

방문은 **어르신 + 방문 날짜** 단위로 관리합니다. 예정 → 방문 시작 → 방문 완료 후에는 기록을 조회하며, 완료를 다시 눌러도 취소되지 않습니다. 완료 정정·미방문·방문 취소에는 사유를 남기며 이전 메모와 변경 이력을 보존합니다. 다음 날에는 새 날짜의 예정 상태를 표시하고 지난 날짜의 완료는 지우지 않습니다. 시작을 누르지 않고 일지를 작성한 경우 시작 시각을 임의로 만들지 않습니다.

v1.38.0 이관은 기존 `last_completed_key`에 남아 있는 최근 완료 정보만 사용합니다. 예전 앱에서 이미 덮어쓴 과거 날짜별 완료 기록은 복원할 수 없으며, 알 수 없는 완료 시각은 미기록으로 표시합니다. 기존 `visit_logs`는 그대로 유지합니다. 명단 백업은 전체 방문 감사 이력의 백업·복원 기능을 대신하지 않습니다.

어르신 위치와 날짜별 방문 상태를 확인하고, 방문 시간과 직선거리를 참고한 방문 순서를 추천받을 수 있습니다. 실제 도로 상황을 반영한 최단 경로를 보장하지는 않습니다.

<br/>

## ✨ 주요 기능 (Features)

- 🗺️ **스마트 지도 뷰 (Naver Maps API)**
  - 줌 레벨에 따른 행정구역(시/도 ➔ 군/구 ➔ 동/읍/면) 폴리곤 및 마커 시각화 (Semantic Zoom)
  - 가까운 위치의 마커가 겹치지 않도록 분산 표시
- 📋 **어르신 명단 관리**
  - 신규 어르신 등록, 주소 검색 및 상세 정보 관리
  - 이름·주소·상세 주소·담당자 조합 검색, 오늘 일정·예정/진행·완료·정기 일정·미방문·취소 필터
  - 목록·그리드·심플 보기와 이름순·방문 시간순·지도 중심 거리순 정렬
  - 날짜별 예정·방문 중·완료·미방문·취소 기록 및 사유를 남기는 정정
- 🧭 **오늘의 경로 추천**
  - 방문 시간과 직선거리를 참고한 방문 순서 추천 및 수동 순서 변경
  - 앱 내 도보 경로와 외부 지도 앱 길안내 연동. 경로 API 실패 시 직선 추정임을 구분해 표시
- 📱 **PWA 및 모바일 최적화**
  - PWA(Progressive Web App) 지원으로 모바일 기기 바탕화면에 앱처럼 설치 가능
  - Android는 기기 방문 알림, 지원하는 웹 브라우저는 서버 구독을 통한 Web Push 사용
  - 알림은 권한·구독·서버 설정 및 운영체제 상태에 따라 달라지며, 권한 미허용 시에도 명단·일정 사용 가능
- 🎨 **아름답고 직관적인 UI/UX**
  - 신규 사용자를 위한 실제 인터랙티브 하이라이트 방식의 가이드 투어 (Joyride)
  - Radix UI와 Framer Motion을 활용한 부드러운 애니메이션 적용

<br/>

## 🛠️ 기술 스택 (Tech Stack)

### Frontend
- **Framework:** Next.js 16 (App Router), React 19
- **Styling:** Tailwind CSS
- **UI & Animation:** Radix UI, Framer Motion, Tabler Icons
- **Maps:** React Naver Maps, GeoJSON

### Backend & DB
- **BaaS:** Supabase (PostgreSQL, Auth, Edge Functions)

### Deployment & Tooling
- **PWA:** Service Worker (sw.js), Web Push
- **Package Manager:** npm

<br/>

## 🚀 시작하기 (Getting Started)

프로젝트를 로컬에서 실행하기 위한 방법입니다.

### 1. 환경 변수 설정
프로젝트 루트 경로에 `.env.local` 파일을 생성하고 아래의 변수들을 입력합니다:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Naver Maps API
NEXT_PUBLIC_NAVER_CLIENT_ID=your_naver_client_id

# Web Push (VAPID)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public_key
```

### 2. 패키지 설치
```bash
npm install
```

### 3. 개발 서버 실행
```bash
npm run dev
```
브라우저에서 [http://localhost:3000/CareRoute/](http://localhost:3000/CareRoute/)로 접속하여 확인할 수 있습니다. Node.js 20.9 이상이 필요합니다.

<br/>

## 💡 참고 사항 (Notes)
- **현재 메뉴:** 지도 / 수급자 / 일정 / 설정. 설정에서는 권한, 캘린더 연동, 표시 방식, 명단 백업 등을 관리합니다.
- **가이드 투어:** 앱 최초 진입 시 실행되며 완료 여부는 이 기기의 `localStorage`에 저장됩니다. 개발 중 다시 확인하려면 `careroute_tutorial_done_v2` 키를 삭제한 뒤 새로고침합니다.
- **공유 리포트:** 선택한 방문 날짜·상태·기록된 완료 시각과 작성자가 선택한 케어 항목을 표시합니다. 문자 버튼은 작성 화면을 열며, 공유 요청·복사 이력은 상대방의 수신 완료를 뜻하지 않습니다.
- **문서 작업 이력:** 인쇄·PDF·공유 작업을 수행한 날짜 기준입니다. 방문 날짜별 감사 이력과 다르며, PDF 경로가 있는 기록만 서버 보관 파일을 다시 열 수 있습니다.
- **명단 백업:** JSON은 어르신 명단을 내보내고 같은 ID 기준으로 복원합니다. CSV는 명단 내보내기용입니다. 전체 방문·활력·복약·문서 이력이나 기기 설정을 모두 백업하지 않습니다.
- **PWA 업데이트:** 백그라운드 서비스 워커(Service Worker)가 업데이트된 경우, 사용자에게 새 버전을 매끄럽게 반영하기 위해 새로고침 메커니즘이 내장되어 있습니다.

<br/>

---
*이 프로젝트는 요양 보호사님들의 따뜻한 발걸음을 응원합니다.* 💛
