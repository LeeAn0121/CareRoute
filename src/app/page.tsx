'use client';

import { useState, useEffect } from 'react';
import { Container, NaverMap, Marker, useNavermaps } from 'react-naver-maps';
import { MapPin, List, Settings } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface RegCode {
  code: string;
  name: string;
}

interface Recipient {
  id: string;
  name: string;
  address: string;
  sido: string;
  sigungu: string;
  dong: string;
  lat: number;
  lng: number;
  visit_time: string;
}

const SIDO_CENTERS: Record<string, { lat: number; lng: number }> = {
  '서울특별시': { lat: 37.5665, lng: 126.9780 },
  '부산광역시': { lat: 35.1796, lng: 129.0756 },
  '대구광역시': { lat: 35.8714, lng: 128.6014 },
  '인천광역시': { lat: 37.4563, lng: 126.7052 },
  '광주광역시': { lat: 35.1595, lng: 126.8526 },
  '대전광역시': { lat: 36.3504, lng: 127.3845 },
  '울산광역시': { lat: 35.5384, lng: 129.3114 },
  '세종특별자치시': { lat: 36.4800, lng: 127.2890 },
  '경기도': { lat: 37.2636, lng: 127.0286 },
  '강원특별자치도': { lat: 37.8854, lng: 127.7298 },
  '충청북도': { lat: 36.6356, lng: 127.4913 },
  '충청남도': { lat: 36.6588, lng: 126.6728 },
  '전북특별자치도': { lat: 35.8202, lng: 127.1088 },
  '전라남도': { lat: 34.8161, lng: 126.4629 },
  '경상북도': { lat: 36.5760, lng: 128.5056 },
  '경상남도': { lat: 35.2383, lng: 128.6925 },
  '제주특별자치도': { lat: 33.4890, lng: 126.4983 },
};

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function Home() {
  const navermaps = useNavermaps();
  const [mapCenter, setMapCenter] = useState({ lat: 37.5666, lng: 126.9784 }); // 기본: 서울시청

  const [sidos, setSidos] = useState<RegCode[]>([]);
  const [sigungus, setSigungus] = useState<RegCode[]>([]);
  const [dongs, setDongs] = useState<RegCode[]>([]);

  const [selectedSido, setSelectedSido] = useState<string>('');
  const [selectedSigungu, setSelectedSigungu] = useState<string>('');
  const [selectedDong, setSelectedDong] = useState<string>('');

  const [markers, setMarkers] = useState<Recipient[]>([]);

  // Supabase에서 데이터 가져오기 (해당 구/동에 맞는 데이터만 필터링)
  useEffect(() => {
    let query = supabase.from('recipients').select('*');
    
    if (selectedDong) {
      query = query.eq('dong', selectedDong);
    } else if (selectedSigungu) {
      query = query.eq('sigungu', selectedSigungu);
    } else if (selectedSido) {
      query = query.eq('sido', selectedSido);
    }

    query.then(({ data, error }) => {
      if (error) {
        console.error('Error fetching recipients:', error);
      } else if (data) {
        setMarkers(data);
      }
    });
  }, [selectedSido, selectedSigungu, selectedDong]);

  // 1. 시/도 데이터 가져오기 및 GPS 정렬
  useEffect(() => {
    fetch('https://grpc-proxy-server-mkvo6j4wsq-du.a.run.app/v1/regcodes?regcode_pattern=*00000000')
      .then(res => res.json())
      .then(data => {
        let loadedSidos = data.regcodes || [];
        
        // 먼저 데이터를 화면에 뿌려줍니다 (GPS 권한 대기 중 빈 화면 방지)
        setSidos(loadedSidos);
        
        if ('geolocation' in navigator) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const { latitude, longitude } = position.coords;
              const sorted = [...loadedSidos].sort((a: RegCode, b: RegCode) => {
                const centerA = SIDO_CENTERS[a.name] || { lat: 37.5665, lng: 126.9780 };
                const centerB = SIDO_CENTERS[b.name] || { lat: 37.5665, lng: 126.9780 };
                const distA = getDistanceFromLatLonInKm(latitude, longitude, centerA.lat, centerA.lng);
                const distB = getDistanceFromLatLonInKm(latitude, longitude, centerB.lat, centerB.lng);
                return distA - distB;
              });
              setSidos(sorted);
              if (sorted.length > 0) setSelectedSido(sorted[0].code);
            },
            (error) => {
              console.error("GPS 위치 정보를 가져올 수 없거나 거부되었습니다.", error);
            }
          );
        }
      });
  }, []);

  // 2. 시/군/구 데이터 가져오기 (시/도가 선택되었을 때)
  useEffect(() => {
    if (!selectedSido) {
      setSigungus([]);
      setSelectedSigungu('');
      return;
    }
    const pattern = selectedSido.substring(0, 2) + '*00000';
    fetch(`https://grpc-proxy-server-mkvo6j4wsq-du.a.run.app/v1/regcodes?regcode_pattern=${pattern}&is_ignore_zero=true`)
      .then(res => res.json())
      .then(data => {
        // 첫 번째 값은 시/도 자체이므로 제외
        const list = (data.regcodes || []).filter((item: RegCode) => item.code !== selectedSido);
        setSigungus(list);
        setSelectedSigungu('');
      });
  }, [selectedSido]);

  // 3. 읍/면/동 데이터 가져오기 (시/군/구가 선택되었을 때)
  useEffect(() => {
    if (!selectedSigungu) {
      setDongs([]);
      setSelectedDong('');
      return;
    }
    const pattern = selectedSigungu.substring(0, 4) + '*';
    // 구가 선택된 경우 하위 동을 가져옴
    const finalPattern = selectedSigungu.substring(0, 5) + '*';
    fetch(`https://grpc-proxy-server-mkvo6j4wsq-du.a.run.app/v1/regcodes?regcode_pattern=${finalPattern}&is_ignore_zero=true`)
      .then(res => res.json())
      .then(data => {
        const list = (data.regcodes || []).filter((item: RegCode) => item.code !== selectedSigungu);
        setDongs(list);
        setSelectedDong('');
      });
  }, [selectedSigungu]);

  // 선택된 지역이 바뀔 때마다 네이버 Geocoding API를 통해 위경도로 변환 후 지도 이동
  useEffect(() => {
    let addressToSearch = '';
    
    if (selectedDong) {
      const dongName = dongs.find(d => d.code === selectedDong)?.name;
      if (dongName) addressToSearch = dongName;
    } else if (selectedSigungu) {
      const sigunguName = sigungus.find(s => s.code === selectedSigungu)?.name;
      if (sigunguName) addressToSearch = sigunguName;
    } else if (selectedSido) {
      const sidoName = sidos.find(s => s.code === selectedSido)?.name;
      if (sidoName) addressToSearch = sidoName;
    }

    if (addressToSearch && navermaps && navermaps.Service) {
      // @ts-ignore
      navermaps.Service.geocode({ query: addressToSearch }, function(status, response) {
        // @ts-ignore
        if (status === navermaps.Service.Status.OK) {
          const item = response.v2.addresses[0];
          if (item) {
            setMapCenter({ lat: parseFloat(item.y), lng: parseFloat(item.x) });
          }
        }
      });
    }
  }, [selectedSido, selectedSigungu, selectedDong, navermaps, sidos, sigungus, dongs]);

  // 이름만 짧게 보여주기 위한 헬퍼 함수 (예: "서울특별시 강남구 역삼동" -> "역삼동")
  const getShortName = (fullName: string) => {
    const parts = fullName.split(' ');
    return parts[parts.length - 1];
  };

  return (
    <main className="flex-1 flex flex-col h-[100dvh] relative">
      <header className="bg-white shadow-sm p-4 z-10 space-y-3">
        <h1 className="text-xl font-bold text-gray-800">오늘의 방문 지역</h1>
        
        <div className="flex gap-2">
          {/* 시/도 */}
          <select
            className="flex-1 p-2 text-sm border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedSido}
            onChange={(e) => setSelectedSido(e.target.value)}
          >
            <option value="">시/도 선택</option>
            {sidos.map((d) => (
              <option key={d.code} value={d.code}>
                {getShortName(d.name)}
              </option>
            ))}
          </select>

          {/* 시/군/구 */}
          <select
            className="flex-1 p-2 text-sm border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            value={selectedSigungu}
            onChange={(e) => setSelectedSigungu(e.target.value)}
            disabled={!selectedSido}
          >
            <option value="">시/군/구 선택</option>
            {sigungus.map((d) => (
              <option key={d.code} value={d.code}>
                {getShortName(d.name)}
              </option>
            ))}
          </select>

          {/* 읍/면/동 */}
          <select
            className="flex-1 p-2 text-sm border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            value={selectedDong}
            onChange={(e) => setSelectedDong(e.target.value)}
            disabled={!selectedSigungu}
          >
            <option value="">읍/면/동 선택</option>
            {dongs.map((d) => (
              <option key={d.code} value={d.code}>
                {getShortName(d.name)}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="flex-1 w-full bg-gray-200 relative">
        <Container className="w-full h-full">
          <NaverMap
            defaultCenter={mapCenter}
            center={mapCenter}
            defaultZoom={15}
          >
            {markers.map((marker) => (
              <Marker
                key={marker.id}
                position={{ lat: marker.lat, lng: marker.lng }}
                onClick={() => alert(`${marker.name}님 (방문시간: ${marker.visit_time.substring(0,5)})`)}
              />
            ))}
          </NaverMap>
        </Container>
      </div>

      <nav className="bg-white border-t border-gray-200 flex justify-around p-3 pb-safe z-10">
        <button className="flex flex-col items-center text-blue-600">
          <MapPin size={24} />
          <span className="text-xs mt-1 font-medium">지도</span>
        </button>
        <button className="flex flex-col items-center text-gray-500 hover:text-blue-600 transition-colors">
          <List size={24} />
          <span className="text-xs mt-1 font-medium">목록</span>
        </button>
        <button className="flex flex-col items-center text-gray-500 hover:text-blue-600 transition-colors">
          <Settings size={24} />
          <span className="text-xs mt-1 font-medium">설정</span>
        </button>
      </nav>
    </main>
  );
}
