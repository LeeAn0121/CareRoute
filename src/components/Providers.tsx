'use client';

import { NavermapsProvider } from 'react-naver-maps';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NavermapsProvider
      ncpClientId={process.env.NEXT_PUBLIC_NAVER_CLIENT_ID || ''}
      submodules={["geocoder"]}
    >
      {children}
    </NavermapsProvider>
  );
}
