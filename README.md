# 📍 CareRoute (케어루트)

**케어루트**는 방문 요양 보호사 및 사회복지사 분들을 위한 **스마트 동선 관리 및 어르신 명단 관리 웹 애플리케이션(PWA)** 입니다.

종이 명단이나 복잡한 지도 앱 대신, 케어루트 하나로 어르신들의 위치를 한눈에 파악하고 가장 효율적인 방문 경로를 추천받으세요!

<br/>

## ✨ 주요 기능 (Features)

- 🗺️ **스마트 지도 뷰 (Naver Maps API)**
  - 줌 레벨에 따른 행정구역(시/도 ➔ 군/구 ➔ 동/읍/면) 폴리곤 및 마커 시각화 (Semantic Zoom)
  - 밀집된 어르신 위치 클러스터링 기능
- 📋 **어르신 명단 관리**
  - 신규 어르신 등록, 주소 검색 및 상세 정보 관리
  - 오늘 방문 예정인 어르신 필터링 및 방문 완료 상태 체크
- 🧭 **오늘의 경로 추천**
  - 등록된 어르신들의 위치(위/경도)를 바탕으로 직선거리 기준 최적의 방문 순서 추천
  - 버튼 클릭 한 번으로 네이버 지도 길찾기 연동
- 📱 **PWA 및 모바일 최적화**
  - PWA(Progressive Web App) 지원으로 모바일 기기 바탕화면에 앱처럼 설치 가능
  - 알림 권한 허용 시, 백그라운드 환경에서도 방문 시간 Web Push 알림 제공
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
브라우저에서 [http://localhost:3000](http://localhost:3000)으로 접속하여 확인할 수 있습니다.

<br/>

## 💡 참고 사항 (Notes)
- **가이드 투어:** 앱 최초 진입 시, 튜토리얼(온보딩)이 실행되며 `localStorage`를 통해 완료 여부가 저장됩니다. 테스트 시 캐시 삭제 버튼을 활용해 초기화할 수 있습니다.
- **PWA 업데이트:** 백그라운드 서비스 워커(Service Worker)가 업데이트된 경우, 사용자에게 새 버전을 매끄럽게 반영하기 위해 새로고침 메커니즘이 내장되어 있습니다.

<br/>

---
*이 프로젝트는 요양 보호사님들의 따뜻한 발걸음을 응원합니다.* 💛
