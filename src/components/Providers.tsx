'use client';

import { useEffect } from 'react';
import { NavermapsProvider, preloadNavermaps } from 'react-naver-maps';

const navermapsOptions = {
  ncpKeyId: 'f9sp6e02ix',
  submodules: ['geocoder'],
};

export default function Providers({ children }: { children: React.ReactNode }) {
  // <NaverMap>은 mapLoaded 상태에 따라 조건부로만 렌더링되는데, 스크립트
  // 로딩 자체는 <NaverMap>이 렌더링돼야 트리거되는 구조라 그대로 두면
  // 순환 대기에 빠져 maps.js 요청이 영영 발생하지 않는다. Provider 마운트
  // 시점에 명시적으로 미리 로딩을 시작한다.
  useEffect(() => {
    preloadNavermaps(navermapsOptions);
  }, []);

  return (
    <NavermapsProvider {...navermapsOptions}>
      {children}
    </NavermapsProvider>
  );
}
