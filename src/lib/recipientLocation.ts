type Coordinates = { lat: number; lng: number };

/** Reject missing, coerced, non-finite, zero and out-of-range coordinates. */
export function isValidCoordinates(value: unknown): value is Coordinates {
  if (!value || typeof value !== 'object') return false;
  const { lat, lng, locationUnresolved } = value as Record<string, unknown>;
  if (locationUnresolved === true) return false;
  return typeof lat === 'number' && typeof lng === 'number'
    && Number.isFinite(lat) && Number.isFinite(lng)
    && lat !== 0 && lng !== 0
    && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

type GeocodeResponse = {
  v2?: { addresses?: { x?: string | number; y?: string | number }[] };
};

function geocodeQuery(query: string, signal?: AbortSignal): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    const abortError = () => new DOMException('주소 검색이 취소되었습니다.', 'AbortError');
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const service = typeof window !== 'undefined' ? window.naver?.maps?.Service : undefined;
    if (!service || typeof service.geocode !== 'function') {
      reject(new Error('네이버 지도 주소 검색을 준비하지 못했습니다. 잠시 후 다시 저장해주세요.'));
      return;
    }

    let settled = false;
    const finish = (error?: Error, coords?: Coordinates) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
      if (error) reject(error);
      else resolve(coords!);
    };
    const onAbort = () => finish(abortError());
    const timeout = setTimeout(() => finish(new Error('주소 검색 시간이 초과되었습니다. 다시 저장해주세요.')), 6000);
    signal?.addEventListener('abort', onAbort, { once: true });

    try {
      service.geocode({ query }, (status: unknown, response: GeocodeResponse) => {
        if (settled) return;
        try {
          const item = response?.v2?.addresses?.[0];
          const coords = { lat: Number(item?.y), lng: Number(item?.x) };
          if (status === service.Status.OK && isValidCoordinates(coords)) {
            finish(undefined, coords);
          } else {
            finish(new Error('주소의 정확한 위치를 찾을 수 없습니다. 주소를 확인하고 다시 저장해주세요.'));
          }
        } catch {
          finish(new Error('주소 검색 응답을 확인할 수 없습니다. 다시 저장해주세요.'));
        }
      });
    } catch {
      finish(new Error('네이버 주소 검색에 실패했습니다. 잠시 후 다시 저장해주세요.'));
    }
  });
}

/** Browser-only Naver lookup: full address first, then the exact base address. */
export async function geocodeRecipientAddress(
  address: string,
  detailAddress?: string,
  signal?: AbortSignal,
): Promise<Coordinates> {
  if (signal?.aborted) throw new DOMException('주소 검색이 취소되었습니다.', 'AbortError');
  const base = address.trim();
  const detail = detailAddress?.trim();
  if (!base) throw new Error('주소를 입력해주세요.');
  if (detail) {
    try {
      return await geocodeQuery(`${base} ${detail}`, signal);
    } catch (error) {
      if (signal?.aborted || (error instanceof Error && error.name === 'AbortError')) throw error;
    }
  }
  return geocodeQuery(base, signal);
}
