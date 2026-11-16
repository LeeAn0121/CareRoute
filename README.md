# 📍 CareRoute (케어루트)

**케어루트**는 방문 요양보호사와 사회복지사를 위한 **방문 일정·어르신 명단 관리 Android 앱 및 웹 애플리케이션(PWA)** 입니다.

현재 버전은 **v1.42.3**이며, Android 앱은 버전 코드 **24**입니다. Android 설치·Google 캘린더 인증·권한 및 서명 빌드는 [ANDROID.md](ANDROID.md), 버전별 변경사항은 [CHANGELOG.md](CHANGELOG.md)를 참고하세요. 태그와 릴리즈 설명은 [GitHub Releases](https://github.com/LeeAn0121/CareRoute/releases)에 기록하며, AAB 파일은 로컬에서만 생성하고 GitHub에는 업로드하지 않습니다.

Google 로그인이 필요하며, 서버에서 확인한 계정의 데이터만 조회·수정합니다. 새 데이터는 생성한 계정에 귀속됩니다. 기존 공용 데이터는 `public.legacy_data_access`의 활성 이메일에만 공유됩니다. 이 허용 목록은 Supabase Table Editor/SQL Editor의 관리자 권한으로 수정하며 앱에서는 수정할 수 없습니다. 초기 허용 계정은 `jggen0121@naver.com`, `jggen0401@gmail.com`, `jggen4177@gmail.com`입니다. 사진·PDF는 비공개 버킷에서 권한을 확인한 만료 링크로 엽니다.

이전 버전은 로그인 없이 데이터에 접근하므로 더 이상 운영 DB에 접근할 수 없습니다. 설치 앱은 새 AAB로 업데이트해야 합니다. 계정 전환 시 명단·출력 초안·임시 건강 수치·정렬 순서을 섞지 않으며, 계정 없는 옛 캐시는 자동으로 가져오지 않습니다. 앱 재실행 시 로그인 검증에는 네트워크가 필요합니다.

Android 7.0 이상 및 Chromium 기반 WebView 111 이상을 실행 기준으로 사용합니다. 작은 화면·폴더블·분할 화면·태블릿·큰 글씨·화면 회전 조건으로 검증하며, 모든 제조사·기종의 실기기 검증을 완료했다는 의미는 아닙니다. 오래된 WebView에서는 업데이트 안내가 표시됩니다.

방문은 **어르신 + 방문 날짜** 단위로 관리합니다. 예정 → 방문 시작 → 방문 완료로 진행하며, 완료 메모는 다시 열어 수정할 수 있습니다. 일정 수정·제거에 정정 사유를 요구하지 않습니다. 제거 직후 되돌리기는 이전 방문 상태를 복원하고, 제거한 일정 목록의 일반 복원은 예정으로 되돌립니다. 서버에서는 계정 권한·동시 수정 충돌·요청 재시도와 변경 감사 기록을 유지합니다.

어르신 위치와 날짜별 방문 상태를 확인하고, 방문 시간과 직선거리를 참고한 방문 순서를 추천받을 수 있습니다. 실제 도로 상황을 반영한 최단 경로를 보장하지는 않습니다.

<br/>

## ✨ 주요 기능 (Features)

- 🗺️ **스마트 지도 뷰 (Naver Maps API)**
  - 지도 레이어에서 행정구역 경계·기상 그리드·현재 지도 위치 날씨 상세 표시
  - 현재 위치·수급자 마커와 시/도 → 시/군/구 → 읍/면/동 선택
  - 상세 주소를 참고한 좌표 확인 및 위치 미확인 상태 안내
- 📋 **어르신 명단 관리**
  - 신규 어르신 등록, 주소 검색 및 상세 정보 관리
  - 이름·주소·상세 주소·담당자 조합 검색, 오늘 일정·예정/진행·완료·정기 일정·미방문·취소 필터
  - 목록·그리드·심플 보기와 이름순·방문 시간순·지도 중심 거리순 정렬
  - 월간 달력과 날짜별 예정·방문 중·완료·취소 상태, 직접 일정 제거·복원
- 🧭 **오늘의 경로 추천**
  - 방문 시간과 직선거리를 참고한 방문 순서 추천 및 수동 순서 변경
  - 외부 지도 앱 길안내 연동
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
- **Maps:** React Naver Maps

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
- **명단 백업:** JSON은 어르신 명단을 내보내고 같은 ID 기준으로 복원합니다. CSV는 명단 내보내기용입니다. 전체 방문·활력·복약·문서 이력이나 기기 설정을 모두 백업하지 않습니다.
- **업데이트 안내:** Android는 실제 Google Play 업데이트 가능 여부를 확인하고 다운로드·설치 버튼을 표시합니다. 웹은 배포 버전을 확인하고 사용자 동의 후 새로고침합니다. 설정에서도 직접 확인할 수 있습니다. 앱 실행·복귀·온라인 복구 및 사용 중 주기적으로 확인하며, 종료된 앱에 즉시 푸시를 보내는 기능은 아닙니다. 이 기능이 포함된 버전을 한 번 설치해야 이후 업데이트 안내를 받을 수 있습니다.
- **출력:** 한 출력 메뉴에서 수급자·선택일·주간 범위를 골라 인쇄·PDF·공유합니다. 서버 출력 보관/작업 이력은 제공하지 않습니다.
- **Google 캘린더:** 선택적인 Google 계정 권한 승인 후 일정 동기화를 사용합니다. iCal 공개 링크 연동은 종료합니다.

<br/>

---
*이 프로젝트는 요양 보호사님들의 따뜻한 발걸음을 응원합니다.* 💛
