'use client';

import { useState } from 'react';
import { Container, MapDiv, NaverMap, Marker } from 'react-naver-maps';
import { MapPin, List, Settings } from 'lucide-react';

const DISTRICTS = [
  { name: '강남구', center: { lat: 37.5172, lng: 127.0473 } },
  { name: '서초구', center: { lat: 37.4837, lng: 127.0324 } },
  { name: '송파구', center: { lat: 37.5145, lng: 127.1058 } },
  // 더 많은 구 추가 가능
];

const MOCK_DATA = [
  { id: 1, name: '김할머니', district: '강남구', lat: 37.5172, lng: 127.0473, time: '10:00' },
  { id: 2, name: '이할아버지', district: '강남구', lat: 37.5200, lng: 127.0500, time: '14:00' },
  { id: 3, name: '박할머니', district: '서초구', lat: 37.4837, lng: 127.0324, time: '11:00' },
];

export default function Home() {
  const [selectedDistrict, setSelectedDistrict] = useState(DISTRICTS[0]);

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
            const found = DISTRICTS.find(d => d.name === e.target.value);
            if (found) setSelectedDistrict(found);
          }}
        >
          {DISTRICTS.map((d) => (
            <option key={d.name} value={d.name}>
              {d.name}
            </option>
          ))}
        </select>
      </header>

      {/* Map Area */}
      <div className="flex-1 w-full bg-gray-200 relative">
        <MapDiv className="w-full h-full">
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
        </MapDiv>
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
