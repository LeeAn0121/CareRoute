# CareRoute Android 비공개 테스트

Capacitor 8로 Next.js 정적 산출물을 앱에 포함합니다. 기존 GitHub Pages 빌드 설정은 유지합니다.

- 앱 이름: 케어루트
- 패키지: `com.leean0121.careroute` (Play 최초 등록 전에 확정)
- Android 최소 API 24, 대상 API 36
- 앱 버전은 `package.json`의 `version`, Android 버전 코드는 `androidVersionCode`를 사용합니다. `CAREROUTE_VERSION_CODE`로 일시 재정의할 수 있습니다.

## 빌드

Node 22 이상, JDK 21, Android SDK 36이 필요합니다. 기존 `.env.local`의 Supabase 공개 설정을 사용합니다. 서비스 역할 키를 앱에 포함하지 않습니다.

```sh
npm ci
npm run android:apk
```

APK: `android/app/build/outputs/apk/debug/app-debug.apk`

## Play 업로드용 서명

다음 환경변수를 본인의 업로드 키에 맞춰 설정한 뒤 `npm run android:bundle`을 실행합니다.

- `CAREROUTE_KEYSTORE_PATH`: 업로드 키 파일 절대 경로
- `CAREROUTE_KEYSTORE_PASSWORD`: 저장소 암호
- `CAREROUTE_KEY_ALIAS`: 키 별칭
- `CAREROUTE_KEY_PASSWORD`: 키 암호
- `CAREROUTE_VERSION_CODE`: 이전 업로드보다 큰 정수

AAB: `android/app/build/outputs/bundle/release/app-release.aab`. 서명키가 없으면 업로드용 스크립트는 중단합니다. 직접 Gradle로 생성한 미서명 AAB는 Play에 올릴 수 없습니다. 키와 암호는 Git에 저장하지 않습니다.

## 비공개 테스트 등록

Play Console에서 앱을 생성하고 패키지명·Play App Signing을 설정합니다. 개인정보처리방침, 데이터 보안, 콘텐츠 등급, 앱 접근 안내 등 Console에서 요구하는 항목을 실제 앱 동작에 맞춰 작성합니다. 비공개 테스트 트랙에 서명 AAB를 업로드하고 이메일/Google 그룹으로 테스터를 지정한 뒤 참여 링크를 공유합니다. 공개 출시 트랙에는 배포하지 않습니다.

## 배포 전 실제 기기 확인

- Supabase 조회·저장 및 접근 제어
- Naver 지도 웹 서비스 허용 주소에 앱 오리진 `https://localhost` 설정 가능 여부와 지도 로딩
- 위치 권한 허용·거절, 외부 지도 앱 이동, 뒤로 가기
- Google 캘린더 OAuth: Android에서는 Google Play 서비스 AuthorizationClient의 계정 선택·동의 화면으로 접근 토큰을 받아 기존 Calendar API 동기화를 실행합니다. 토큰은 JavaScript 저장소에 보관하지 않습니다. 웹에서는 기존 GIS 인증을 유지합니다.
- PDF·JSON·CSV 내보내기는 Android 공유창에서 저장 대상 앱을 선택합니다. PDF/리포트 공유도 Android 공유창을 사용합니다.
- 인쇄 버튼은 Android 인쇄 서비스를 열며, 음성 입력은 기기의 한국어 음성 인식 서비스를 사용합니다.
- 알림 권한 요청·알림 테스트는 Android 로컬 알림으로 연결했습니다. 앱에서 읽은 향후 7일 일정(최대 200건)을 예약합니다. 정확한 시각은 Android 절전 정책에 따라 지연될 수 있습니다. 7일 이후 일정은 앱을 다시 열어 갱신해야 합니다.
- 다른 기기에서 바뀐 일정을 서버가 즉시 전송하는 푸시는 별도 FCM 연결이 필요합니다.
- Android 뒤로 가기는 대화상자 닫기, 지도 탭 복귀, 앱 최소화 순서로 처리합니다.

지도 허용 URL은 정확히 `https://localhost`입니다 (`lcoalhost`가 아님). 지도 서비스 오류가 나도 수급자·일정 화면은 사용할 수 있습니다.

Google 캘린더 네이티브 인증에는 Google Cloud Android OAuth 클라이언트의 패키지명과 서명 SHA-1 등록이 필요합니다. Play 설치본은 로컬 업로드 키가 아닌 Play Console 앱 무결성의 **앱 서명 인증서** SHA-1을 사용합니다. FCM에는 해당 Firebase 프로젝트의 Android 설정 파일과 서버 발송 설정이 필요합니다.

## 기존 Google Cloud 프로젝트에 Android 캘린더 인증 등록

1. 기존 웹 OAuth 클라이언트와 같은 Google Cloud 프로젝트를 선택합니다.
2. Google Calendar API를 사용 설정합니다.
3. Google Auth Platform → 클라이언트 → 클라이언트 만들기에서 Android를 선택합니다.
4. 패키지 이름: `com.leean0121.careroute`.
5. Play Console → 앱 무결성 → 앱 서명에서 **앱 서명 키 인증서** SHA-1을 복사해 등록합니다.
6. OAuth 대상이 테스트 상태라면 Google Auth Platform → 대상의 테스트 사용자에 캘린더를 연결할 Google 계정을 추가합니다. Play 비공개 테스터 목록과 별도입니다.
7. OAuth 데이터 액세스에 `https://www.googleapis.com/auth/calendar.events` 범위를 확인합니다.

로컬에서 업로드 키로 서명한 APK를 직접 설치해 시험할 때는 별도 Android OAuth 클라이언트에 업로드 키 SHA-1 `DA:75:9D:FB:E0:39:59:8B:9E:4A:D4:B7:00:EC:89:8B:17:5A:50:85`를 등록합니다. Play 설치본에 이 지문을 대신 사용하지 않습니다.

Android 인증 코드에는 OAuth 클라이언트 비밀키나 Firebase 설정이 필요하지 않습니다. 콘솔 등록 후 실제 Google 계정의 동의 및 일정 생성은 기기에서 확인해야 합니다.

## v1.36.1 앱 아이콘·권한 점검

- 설치용 아이콘은 Play 스토어 등록정보와 별도입니다. Manifest의 일반·원형 아이콘을 케어루트 리소스로 변경했고 Android 8 적응형·Android 13 테마 단색·구형 밀도별 PNG를 포함합니다. 네이티브 시작 화면과 알림 아이콘도 같은 브랜드를 사용합니다.
- `npm run android:sync`에서 `public/logo.svg`로 구형 런처 및 시작 이미지를 재생성합니다.
- 위치는 사용 중에만 coarse/fine 권한을 사용하며 대략적 위치만 허용한 경우도 허용 상태로 표시합니다. 백그라운드 위치는 요청하지 않습니다.
- Android 13 이상 알림 권한은 사용자가 설정에서 켤 때 요청합니다. 로컬 방문 알림은 inexact 방식으로 예약하고 `SCHEDULE_EXACT_ALARM` 권한은 최종 Manifest에서 제거합니다.
- 저장소 전체 접근·사진·연락처·기기 캘린더·마이크 런타임 권한은 요청하지 않습니다. 음성 입력은 별도 인식 앱에 위임하고 캘린더는 Google OAuth 동의를 사용합니다.
- 공유 파일 제공 범위는 앱 캐시의 `exports/` 폴더로 제한합니다.
- 설정에서 Android 앱 권한 화면을 열 수 있고, 복귀하면 위치·알림 상태를 갱신합니다.
- versionCode 6. Play 테스트 업데이트 후 런처에서 확인해야 하며 실제 제조사별 마스크·테마 아이콘 렌더링은 기기 확인이 필요합니다.

## v1.36.2 지도 로딩 수정

- SDK 로딩 URL에 완료 콜백을 등록해 `jsContentLoaded` 상태를 기다리기만 하던 문제를 수정했습니다.
- Android 오리진 `https://localhost`에서 Client ID를 비교 검증한 결과 `f9sp6e02ix`는 지도 인증 HTTP 200, 기존 로컬 환경값 `dxr1zrae95`는 HTTP 401이었습니다. 로컬 `.env.local`의 지도 공개 Client ID를 정상 값으로 수정했습니다. CI 빌드에도 동일한 Maps Application의 공개 Client ID를 설정해야 합니다.
- 버전 코드 7. 실제 계정·위치·기기에서의 동작은 Play 비공개 테스트 업데이트 후 확인합니다.

현재 APK/AAB 생성과 실제 기기 기능 검증·Play 게시 완료는 별개입니다.

## v1.37.0 화면·기능 검증

- 버전 코드 9. 모바일 320/360/390/412px, 가로 화면 740×360, PC 1280×800을 확인했습니다.
- 지도, 목록·그리드·심플, 등록·수정, 일정·일정 관리·추가, 상세, 음성 일지, 공유·이력, 단일·일별·주간 출력, 복약, 활력 이력, 설정을 순회했습니다.
- 라이트 144개와 다크 96개 화면 상태에서 가로 넘침·실행 오류를 검사했습니다. 외부 주소 선택·Supabase·Calendar API는 샘플 및 모의 응답으로 기능 검증했으며 실제 사용자 데이터는 수정하지 않았습니다.
- 삭제·등록 오류 처리, 1,001건 백업, 캘린더 실패 시 기존 일정 보존, 방문·활력 이력 재전송을 보완했습니다.
- 장치별 키보드·제조사 WebView, Google 실제 계정 인증, 실제 인쇄·공유·음성 서비스 및 원격 Supabase 정책은 기기에서 추가 확인해야 합니다.
- 방문 시간은 어르신별 공통값입니다. 반복 일정 제외는 해당 요일 전체를 해제하므로 확인창에서 이를 안내합니다.

## v1.37.1 기기별 화면 대응

- 버전 코드 10. WebView의 `--safe-area-inset-*`를 우선 적용하고 웹에서는 `env(safe-area-inset-*)`로 대체합니다.
- 목록·일정·설정, 모달·출력·이력, 지도 팝업과 하단 메뉴의 안전 영역 및 스크롤을 보완했습니다.
- 가로 화면 지도 버튼은 가로로 배치하며, 낮은 화면에서 팝업 내용을 스크롤할 수 있습니다.
- AAB는 `android/app/build/outputs/bundle/release/CareRoute-v1.37.1-code10.aab`에 로컬 보관하며 GitHub 릴리즈에는 첨부하지 않습니다.
- Play Console에서 새 AAB를 게시한 뒤 테스터가 업데이트해야 적용됩니다. 브라우저 모의 검증은 실제 S21/S23의 키보드·시스템 글자 크기·제스처/버튼 내비게이션 검증을 대체하지 않습니다.
