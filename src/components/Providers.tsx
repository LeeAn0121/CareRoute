'use client';

import { NavermapsProvider } from 'react-naver-maps';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NavermapsProvider
      ncpClientId={'f9sp6e02ix'}
      submodules={["geocoder"]}
    >
      {children}
    </NavermapsProvider>
  );
}
