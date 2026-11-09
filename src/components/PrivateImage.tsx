'use client';

import { forwardRef, useEffect, useRef, useState, useSyncExternalStore, type ImgHTMLAttributes, type ReactNode } from 'react';
import { captureAccountStorage, getAccountStorageRevision, subscribeAccountStorage } from '@/lib/accountStorage';
import { getStorageObjectPath, invalidatePrivateStorageUrl, PRIVATE_STORAGE_TTL_SECONDS, resolveRecipientPhotoUrl } from '@/lib/privateStorage';

export interface PrivateImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet' | 'children' | 'dangerouslySetInnerHTML'> {
  /** Canonical recipient-photo path or this project's legacy public/signed URL.
   * Same-origin blob URLs and raster image data URLs are supported for previews.
   */
  src?: string | null;
  alt: string;
  fallback?: ReactNode;
}

function serverRevision() { return 0; }

export function isLocalImagePreview(src: string): boolean {
  if (src.startsWith('blob:')) {
    try { return new URL(src).origin === window.location.origin; } catch { return false; }
  }
  return /^data:image\/(?:png|jpe?g|gif|webp|avif|bmp|x-icon)(?:;[^,]*)?,/i.test(src);
}

/** Keeps signatures in component/memory state, never in patient records/cache. */
const PrivateImage = forwardRef<HTMLImageElement, PrivateImageProps>(function PrivateImage(
  { src, alt, fallback, crossOrigin = 'anonymous', onError, ...imageProps }, ref,
) {
  const revision = useSyncExternalStore(subscribeAccountStorage, getAccountStorageRevision, serverRevision);
  const [resolved, setResolved] = useState<{ src: string; revision: number; url: string | null } | null>(null);
  const retryRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const scope = captureAccountStorage();
    if (!src || !scope.isCurrent()) return;
    let active = true;
    let requestNumber = 0;
    let imageRetries = 0;
    const update = (url: string | null, request: number) => {
      if (active && scope.isCurrent() && request === requestNumber) setResolved({ src, revision, url });
    };
    const refresh = async () => {
      const request = ++requestNumber;
      if (!scope.isCurrent()) return;
      try {
        if (isLocalImagePreview(src)) {
          update(src, request);
          return;
        }
        // Reject other schemes, foreign origins and non-photo buckets before signing.
        if (/^[a-z][a-z\d+.-]*:/i.test(src) && !/^https?:\/\//i.test(src)) throw new Error('Unsupported image source');
        getStorageObjectPath('recipient-photos', src);
        update(await resolveRecipientPhotoUrl(src), request);
      } catch { update(null, request); }
    };
    retryRef.current = () => {
      if (!active || !scope.isCurrent()) return;
      if (isLocalImagePreview(src) || imageRetries++ >= 1) {
        update(null, requestNumber);
        return;
      }
      try { invalidatePrivateStorageUrl('recipient-photos', src); } catch { return; }
      void refresh();
    };
    const renew = () => { imageRetries = 0; void refresh(); };
    const onVisible = () => { if (document.visibilityState === 'visible') renew(); };
    void refresh();
    const timer = window.setInterval(() => {
      if (!scope.isCurrent()) return;
      // Force renewal: the shared cache may still be valid at the four-minute
      // mark, but reusing it here would leave an expired URL until minute eight.
      if (!isLocalImagePreview(src)) {
        try { invalidatePrivateStorageUrl('recipient-photos', src); } catch { /* refresh rejects invalid sources */ }
      }
      renew();
    }, (PRIVATE_STORAGE_TTL_SECONDS - 60) * 1000);
    window.addEventListener('focus', renew);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      retryRef.current = null;
      window.clearInterval(timer);
      window.removeEventListener('focus', renew);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [src, revision]);

  const scope = captureAccountStorage();
  const url = scope.isCurrent() && resolved && resolved.src === src && resolved.revision === revision ? resolved.url : null;
  if (!url && fallback !== undefined) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...imageProps}
      key={`${revision}:${src ?? ''}`}
      ref={ref}
      src={url ?? undefined}
      alt={alt}
      crossOrigin={crossOrigin}
      referrerPolicy={imageProps.referrerPolicy ?? 'no-referrer'}
      onError={event => { retryRef.current?.(); onError?.(event); }}
    />
  );
});

export default PrivateImage;
