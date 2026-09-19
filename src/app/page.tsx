'use client';

import { useState, useEffect } from 'react';
import { Container, NaverMap, Marker } from 'react-naver-maps';
import { MapPin, List, Settings } from 'lucide-react';
import { KOREA_DISTRICTS, getDistanceFromLatLonInKm } from '@/lib/districts';

const MOCK_DATA = [
  { id: 1, name: '김할머니', district: '강남구', lat: 37.5172, lng: 127.0473, time: '10:00' },
  { id: 2, name: '이할아버지', district: '강남구', lat: 37.5200, lng: 127.0500, time: '14:00' },
  { id: 3, name: '박할머니', district: '서초구', lat: 37.4837, lng: 127.0324, time: '11:00' },
  { id: 4, name: '최할아버지', district: '수원시', lat: 37.2650, lng: 127.0300, time: '15:00' },
];

export default function Home() {
  const [districts, setDistricts] = useState(KOREA_DISTRICTS);
  const [selectedDistrict, setSelectedDistrict] = useState(KOREA_DISTRICTS[0]);

  // GPS를 통해 현재 위치를 가져오고 가까운 순으로 구 리스트를 정렬합니다.
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const sortedDistricts = [...KOREA_DISTRICTS].sort((a, b) => {
            const distA = getDistanceFromLatLonInKm(latitude, longitude, a.center.lat, a.center.lng);
            const distB = getDistanceFromLatLonInKm(latitude, longitude, b.center.lat, b.center.lng);
            return distA - distB;
          });
          setDistricts(sortedDistricts);
          setSelectedDistrict(sortedDistricts[0]);
        },
        (error) => {
          console.error("GPS 위치 정보를 가져올 수 없습니다.", error);
        }
      );
    }
  }, []);

  const filteredMarkers = MOCK_DATA.filter(
    (item) => item.district === selectedDistrict.name
  );

  return (
    <main className="flex-1 flex flex-col h-[100dvh] relative">
      {/* Header */}
      <header className="bg-white shadow-sm p-4 z-10">
        <h1 className="text-xl font-bold text-gray-800 mb-2">오늘의 방문 일정</h1>
        <select
          className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={selectedDistrict.name}
          onChange={(e) => {
            const found = districts.find(d => d.name === e.target.value);
            if (found) setSelectedDistrict(found);
          }}
        >
          {districts.map((d) => (
            <option key={d.name} value={d.name}>
              {d.name}
            </option>
          ))}
        </select>
      </header>

      {/* Map Area */}
      <div className="flex-1 w-full bg-gray-200 relative">
        <Container className="w-full h-full">
          <NaverMap
            defaultCenter={selectedDistrict.center}
            center={selectedDistrict.center}
            defaultZoom={14}
          >
            {filteredMarkers.map((marker) => (
              <Marker
                key={marker.id}
                position={{ lat: marker.lat, lng: marker.lng }}
                onClick={() => alert(`${marker.name}님 (방문시간: ${marker.time})`)}
              />
            ))}
          </NaverMap>
        </Container>
      </div>

      {/* Bottom Navigation */}
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
