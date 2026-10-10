const fs = require('fs');
let code = fs.readFileSync('src/app/page.tsx', 'utf-8');

const targetStr = `      const onSuccess = (position: GeolocationPosition) => {
        // 사용자가 이미 다른 곳을 클릭해서 이동 중이라면 방해하지 않음
        if (selectedSido || selectedSigungu || selectedDong) return;
        
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setMapCenter({ lat, lng });
        setMyLocation({ lat, lng });
        setMapZoom(16); // GPS 위치로 자동 포커싱 시 조금 더 상세하게 줌인

        if (watchIdRef.current === null) {
          watchIdRef.current = navigator.geolocation.watchPosition(
            (pos) => setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (err) => console.warn("Watch position error:", err),
            { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
          );
        }
      };

      // 1. 고정밀 모드로 5초 대기 (자동 포커싱용)
      navigator.geolocation.getCurrentPosition(
        onSuccess,
        (error) => {
          if (error.code === error.PERMISSION_DENIED) return;
          // 2. 실패 시 저정밀/캐시 모드로 재시도
          navigator.geolocation.getCurrentPosition(
            onSuccess,
            (err2) => console.warn('초기 위치 정보를 가져올 수 없습니다.', err2),
            { enableHighAccuracy: false, maximumAge: 60000, timeout: 10000 }
          );
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
      );`;

const newStr = `      let firstAccuratePanDone = false;

      // 1. 즉시 캐시된 마지막 위치나 기지국 위치로 화면을 바로 이동 (체감 속도 0.1초)
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (selectedSido || selectedSigungu || selectedDong) return;
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setMyLocation({ lat, lng });
          
          if (!firstAccuratePanDone) {
            setMapCenter({ lat, lng });
            setMapZoom(16);
          }
        },
        () => {},
        { enableHighAccuracy: false, maximumAge: 600000, timeout: 3000 } // 최대 10분 전 캐시 허용
      );

      // 2. 동시에 고정밀 GPS 센서 추적 시작 (센서 예열 후 정확한 좌표로 보정)
      if (watchIdRef.current === null) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            setMyLocation({ lat, lng });
            
            // 최초 1회, 정확한 GPS가 잡히면 화면을 정교하게 다시 맞춰줌.
            if (!firstAccuratePanDone && !(selectedSido || selectedSigungu || selectedDong)) {
              firstAccuratePanDone = true;
              setMapCenter({ lat, lng });
              setMapZoom(16);
            }
          },
          (err) => console.warn("Watch position error:", err),
          { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
        );
      }`;

code = code.replace(targetStr, newStr);
fs.writeFileSync('src/app/page.tsx', code);
console.log("Patched GPS initialization speed");
