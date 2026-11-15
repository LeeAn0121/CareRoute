# 지역 목록 출처

`regions.json`은 행정안전부 행정표준코드관리시스템의 **법정동 코드 전체자료**에서 `폐지여부=존재`인 시·도 / 시·군·구 / 읍·면·동을 추출한 공개 지역 코드입니다. 개인·수급자 데이터가 아닙니다.

- 출처: https://www.code.go.kr/stdcode/regCodeL.do
- 원본 다운로드: https://www.code.go.kr/etc/codeFullDown.do?codeseId=00002
- 수집 시각: JSON의 `retrievedAt` 참고
- 변환: 리 단위 제외, 코드 순서 정렬. 시도와 시군구에 해당하지 않는 `00`으로 끝나는 코드는 읍·면·동 수준입니다.
- 세종의 중간 시군구 부재와 수원 등 비자치구를 가진 시의 하위 목록은 `src/lib/regions.ts`에서 처리합니다.

수동 갱신: 저장소 루트에서 `python3 scripts/update-regions.py`. 공식 원본 구조·레코드 수·중복을 검사하며 비정상 원본이면 중단합니다. 결과를 검토한 후 앱을 다시 빌드합니다. 앱 실행 시 외부 지역 API에 의존하지 않습니다.
