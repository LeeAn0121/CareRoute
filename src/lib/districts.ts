export const KOREA_DISTRICTS = [
  // 서울 (25개 구)
  { name: '강남구', center: { lat: 37.5172, lng: 127.0473 } },
  { name: '강동구', center: { lat: 37.5301, lng: 127.1238 } },
  { name: '강북구', center: { lat: 37.6396, lng: 127.0257 } },
  { name: '강서구', center: { lat: 37.5509, lng: 126.8495 } },
  { name: '관악구', center: { lat: 37.4784, lng: 126.9516 } },
  { name: '광진구', center: { lat: 37.5385, lng: 127.0823 } },
  { name: '구로구', center: { lat: 37.4954, lng: 126.8874 } },
  { name: '금천구', center: { lat: 37.4568, lng: 126.8954 } },
  { name: '노원구', center: { lat: 37.6542, lng: 127.0568 } },
  { name: '도봉구', center: { lat: 37.6688, lng: 127.0471 } },
  { name: '동대문구', center: { lat: 37.5744, lng: 127.0400 } },
  { name: '동작구', center: { lat: 37.5124, lng: 126.9393 } },
  { name: '마포구', center: { lat: 37.5662, lng: 126.9016 } },
  { name: '서대문구', center: { lat: 37.5791, lng: 126.9368 } },
  { name: '서초구', center: { lat: 37.4837, lng: 127.0324 } },
  { name: '성동구', center: { lat: 37.5633, lng: 127.0371 } },
  { name: '성북구', center: { lat: 37.5891, lng: 127.0182 } },
  { name: '송파구', center: { lat: 37.5145, lng: 127.1058 } },
  { name: '양천구', center: { lat: 37.5169, lng: 126.8664 } },
  { name: '영등포구', center: { lat: 37.5260, lng: 126.8966 } },
  { name: '용산구', center: { lat: 37.5326, lng: 126.9900 } },
  { name: '은평구', center: { lat: 37.6027, lng: 126.9291 } },
  { name: '종로구', center: { lat: 37.5729, lng: 126.9793 } },
  { name: '중구', center: { lat: 37.5636, lng: 126.9975 } },
  { name: '중랑구', center: { lat: 37.6065, lng: 127.0924 } },
  
  // 주요 광역시 및 도시
  { name: '부산광역시', center: { lat: 35.1795, lng: 129.0756 } },
  { name: '대구광역시', center: { lat: 35.8714, lng: 128.6014 } },
  { name: '인천광역시', center: { lat: 37.4562, lng: 126.7052 } },
  { name: '광주광역시', center: { lat: 35.1595, lng: 126.8526 } },
  { name: '대전광역시', center: { lat: 36.3504, lng: 127.3845 } },
  { name: '울산광역시', center: { lat: 35.5383, lng: 129.3113 } },
  { name: '세종특별자치시', center: { lat: 36.4800, lng: 127.2890 } },
  { name: '제주특별자치도', center: { lat: 33.4890, lng: 126.4983 } },
  { name: '수원시', center: { lat: 37.2635, lng: 127.0286 } },
  { name: '성남시', center: { lat: 37.4200, lng: 127.1265 } },
  { name: '고양시', center: { lat: 37.6583, lng: 126.8320 } },
  { name: '용인시', center: { lat: 37.2410, lng: 127.1775 } },
  { name: '부천시', center: { lat: 37.5034, lng: 126.7660 } },
  { name: '안산시', center: { lat: 37.3218, lng: 126.8308 } },
  { name: '안양시', center: { lat: 37.3943, lng: 126.9568 } },
  { name: '남양주시', center: { lat: 37.6360, lng: 127.2165 } },
  { name: '화성시', center: { lat: 37.1994, lng: 126.8315 } },
  // 필요 시 시군구를 더 추가할 수 있습니다.
];

// 두 위경도 좌표 간의 거리 계산 (Haversine formula, 단위: km)
export function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // 지구의 반지름 (km)
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
