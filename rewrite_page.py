import re

page_path = "src/app/page.tsx"

new_code = """'use client';
import { useState, useEffect } from 'react';
import { Container, NaverMap, Marker } from 'react-naver-maps';
import { MapPin, List, Plus, Navigation, Clock, User, Download, Share, X, ChevronRight, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import RecipientModal from '@/components/RecipientModal';

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

const SIDO_CENTERS: Record<string, { lat: number, lng: number }> = {
  '서울특별시': { lat: 37.5665, lng: 126.9780 },
  '부산광역시': { lat: 35.1795, lng: 129.0756 },
  '대구광역시': { lat: 35.8714, lng: 128.6014 },
  '인천광역시': { lat: 37.4562, lng: 126.7052 },
  '광주광역시': { lat: 35.1595, lng: 126.8526 },
  '대전광역시': { lat: 36.3504, lng: 127.3845 },
  '울산광역시': { lat: 35.5383, lng: 129.3113 },
  '세종특별자치시': { lat: 36.4800, lng: 127.2890 },
  '경기도': { lat: 37.2750, lng: 127.0096 },
  '강원특별자치도': { lat: 37.8853, lng: 127.7298 },
  '충청북도': { lat: 36.6358, lng: 127.4913 },
  '충청남도': { lat: 36.6588, lng: 126.6728 },
  '전북특별자치도': { lat: 35.8203, lng: 127.1087 },
  '전라남도': { lat: 34.8160, lng: 126.4629 },
  '경상북도': { lat: 36.5760, lng: 128.5055 },
  '경상남도': { lat: 35.2382, lng: 128.6925 },
  '제주특별자치도': { lat: 33.4890, lng: 126.4983 }
};

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export default function Home() {
  const [sidos, setSidos] = useState<RegCode[]>([]);
  const [sigungus, setSigungus] = useState<RegCode[]>([]);
  const [dongs, setDongs] = useState<RegCode[]>([]);

  const [selectedSido, setSelectedSido] = useState('');
  const [selectedSigungu, setSelectedSigungu] = useState('');
  const [selectedDong, setSelectedDong] = useState('');

  const [markers, setMarkers] = useState<Recipient[]>([]);
  const [mapCenter, setMapCenter] = useState({ lat: 37.5665, lng: 126.9780 });
  const [selectedRecipient, setSelectedRecipient] = useState<Recipient | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState<Recipient | null>(null);
  
  const [activeTab, setActiveTab] = useState<'map' | 'list'>('map');
  const [mapLoaded, setMapLoaded] = useState(false);

  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true); // default true to hide initially

  useEffect(() => {
    // Check iOS and Standalone
    const ios = /iPad|iPhone|iPod/i.test(navigator.userAgent);
    setIsIOS(ios);
    
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    // Register Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/CareRoute/sw.js').catch(console.error);
    }

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Map loading check
    let attempts = 0;
    const checkMap = setInterval(() => {
      attempts++;
      if (typeof window !== 'undefined' && window.naver && window.naver.maps && window.naver.maps.Map) {
        setMapLoaded(true);
        clearInterval(checkMap);
      }
      if (attempts > 20) {
        clearInterval(checkMap);
      }
    }, 500);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      clearInterval(checkMap);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      alert("아이폰에서는 화면 하단의 '공유' 아이콘(네모 위로 화살표)을 누른 후, '홈 화면에 추가'를 선택해주세요!");
      setShowInstallPrompt(false);
      return;
    }
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
    }
  };

  const fetchMarkers = () => {
    let query = supabase.from('recipients').select('*');
    if (selectedDong) query = query.eq('dong', selectedDong);
    else if (selectedSigungu) query = query.eq('sigungu', selectedSigungu);
    else if (selectedSido) query = query.eq('sido', selectedSido);

    query.then(({ data, error }) => {
      if (!error && data) setMarkers(data);
    });
  };

  useEffect(() => {
    fetchMarkers();
  }, [selectedSido, selectedSigungu, selectedDong]);

  useEffect(() => {
    fetch('https://grpc-proxy-server-mkvo6j4wsq-du.a.run.app/v1/regcodes?regcode_pattern=*00000000')
      .then(res => res.json())
      .then(data => {
        let loadedSidos = data.regcodes || [];
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
            () => {}
          );
        }
      });
  }, []);

  useEffect(() => {
    if (selectedSido) {
      const pattern = selectedSido.substring(0, 2) + '*00000';
      fetch(`https://grpc-proxy-server-mkvo6j4wsq-du.a.run.app/v1/regcodes?regcode_pattern=${pattern}&is_ignore_zero=true`)
        .then(res => res.json())
        .then(data => {
          setSigungus(data.regcodes || []);
          setSelectedSigungu('');
          setDongs([]);
          setSelectedDong('');
        });
    }
  }, [selectedSido]);

  useEffect(() => {
    if (selectedSigungu) {
      const pattern = selectedSigungu.substring(0, 5) + '*';
      fetch(`https://grpc-proxy-server-mkvo6j4wsq-du.a.run.app/v1/regcodes?regcode_pattern=${pattern}&is_ignore_zero=true`)
        .then(res => res.json())
        .then(data => {
          setDongs(data.regcodes || []);
          setSelectedDong('');
        });
    }
  }, [selectedSigungu]);

  const handleDelete = async (id: string) => {
    if (window.confirm('정말 삭제하시겠습니까?')) {
      await supabase.from('recipients').delete().eq('id', id);
      fetchMarkers();
      if (selectedRecipient?.id === id) setSelectedRecipient(null);
    }
  };

  const handleDirections = (lat: number, lng: number, name: string) => {
    const isAndr = /android/i.test(navigator.userAgent);
    
    if (isAndr) {
      window.location.href = `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(name)})`;
    } else if (isIOS) {
      window.location.href = `maps://?q=${encodeURIComponent(name)}&ll=${lat},${lng}`;
    } else {
      window.open(`https://m.map.naver.com/route.nhn?menu=route&ename=${encodeURIComponent(name)}&ex=${lng}&ey=${lat}&pathType=0&showMap=true`, '_blank');
    }
  };

  return (
    <main className="flex-1 flex flex-col h-[100dvh] relative bg-slate-50 font-sans">
      
      {/* PWA Install Banner */}
      {(!isStandalone && (showInstallPrompt || isIOS)) && (
        <div className="absolute top-4 left-4 right-4 z-[60] bg-teal-600 text-white p-4 rounded-2xl shadow-xl flex items-center justify-between animate-fade-in-down">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-xl">
              <Download size={20} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-sm">앱으로 설치하기</p>
              <p className="text-xs text-teal-100">바탕화면에서 바로 실행하세요</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleInstallClick}
              className="px-4 py-2 bg-white text-teal-700 font-bold rounded-xl text-sm shadow-sm active:scale-95 transition-transform"
            >
              설치
            </button>
            <button onClick={() => { setShowInstallPrompt(false); setIsIOS(false); }} className="p-2 text-teal-200">
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Floating Header */}
      <header className="absolute top-4 left-4 right-4 z-20 flex flex-col gap-2">
        <div className="bg-white/90 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl p-4 border border-white/20">
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-teal-500 rounded-xl flex items-center justify-center shadow-inner">
              <MapPin size={18} className="text-white" />
            </div>
            케어루트
          </h1>
          
          <div className="flex gap-2">
            <select
              value={selectedSido}
              onChange={(e) => setSelectedSido(e.target.value)}
              className="w-1/3 p-3 bg-slate-50 border-none rounded-xl text-[15px] font-bold text-slate-700 shadow-sm outline-none focus:ring-2 focus:ring-teal-500 transition-all appearance-none"
              aria-label="시/도 선택"
            >
              <option value="">시/도</option>
              {sidos.map(sido => <option key={sido.code} value={sido.code}>{sido.name}</option>)}
            </select>
            <select
              value={selectedSigungu}
              onChange={(e) => setSelectedSigungu(e.target.value)}
              className="w-1/3 p-3 bg-slate-50 border-none rounded-xl text-[15px] font-bold text-slate-700 shadow-sm outline-none focus:ring-2 focus:ring-teal-500 transition-all appearance-none"
              aria-label="시/군/구 선택"
              disabled={!selectedSido}
            >
              <option value="">시/군/구</option>
              {sigungus.map(sig => <option key={sig.code} value={sig.code}>{sig.name.split(' ').pop()}</option>)}
            </select>
            <select
              value={selectedDong}
              onChange={(e) => setSelectedDong(e.target.value)}
              className="w-1/3 p-3 bg-slate-50 border-none rounded-xl text-[15px] font-bold text-slate-700 shadow-sm outline-none focus:ring-2 focus:ring-teal-500 transition-all appearance-none"
              aria-label="동/읍/면 선택"
              disabled={!selectedSigungu}
            >
              <option value="">동/읍/면</option>
              {dongs.map(dong => <option key={dong.code} value={dong.code}>{dong.name.split(' ').pop()}</option>)}
            </select>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 relative w-full h-full bg-slate-100">
        
        {/* Map View */}
        <div className={`absolute inset-0 top-0 ${activeTab === 'map' ? 'block' : 'hidden'}`}>
          {mapLoaded ? (
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
                    onClick={() => setSelectedRecipient(marker)}
                    icon={{
                      content: `
                        <div class="relative flex items-center justify-center w-12 h-12 ${selectedRecipient?.id === marker.id ? 'scale-110 z-50' : 'scale-100'} transition-transform duration-300">
                          <div class="absolute inset-0 bg-teal-500 rounded-full opacity-30 animate-ping"></div>
                          <div class="relative bg-teal-600 text-white rounded-full p-2.5 shadow-[0_4px_12px_rgba(13,148,136,0.5)] border-2 border-white">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                          </div>
                        </div>
                      `,
                      anchor: { x: 24, y: 24 }
                    }}
                  />
                ))}
              </NaverMap>
            </Container>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-400 px-8 text-center pt-20">
              <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm mb-6">
                <MapPin size={40} className="text-slate-300" />
              </div>
              <p className="font-extrabold text-xl text-slate-600 mb-3 tracking-tight">지도 연동 대기 중</p>
              <p className="text-[15px] leading-relaxed">네이버 클라우드 서버 동기화가 지연되고 있습니다.<br/>(목록 탭은 지금 바로 정상 사용 가능합니다!)</p>
            </div>
          )}
        </div>

        {/* List View (Redesigned) */}
        {activeTab === 'list' && (
          <div className="absolute inset-0 overflow-y-auto px-4 pt-[160px] pb-32 bg-slate-50">
            {markers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 mt-20">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                  <User size={32} className="text-slate-300" />
                </div>
                <p className="font-bold text-lg text-slate-500">이 지역엔 등록된 어르신이 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {markers.sort((a,b) => a.visit_time.localeCompare(b.visit_time)).map((marker) => (
                  <div key={marker.id} className="bg-white rounded-[24px] shadow-[0_2px_20px_rgb(0,0,0,0.03)] p-6 border border-slate-100 transition-all active:scale-[0.98]">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-teal-50 rounded-2xl flex items-center justify-center">
                          <User size={24} className="text-teal-600" />
                        </div>
                        <div>
                          <h2 className="text-[22px] font-black text-slate-900 tracking-tight">
                            {marker.name} 어르신
                          </h2>
                          <div className="flex items-center gap-1.5 text-teal-600 font-bold mt-1 text-[15px]">
                            <Clock size={16} />
                            {marker.visit_time.substring(0, 5)} 방문
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { setEditingRecipient(marker); setIsModalOpen(true); }} className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 active:bg-slate-200" aria-label="수정">
                          <Pencil size={18} />
                        </button>
                        <button onClick={() => handleDelete(marker.id)} className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center text-red-400 active:bg-red-100" aria-label="삭제">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                    
                    <div className="bg-slate-50 p-4 rounded-2xl mb-4">
                      <p className="text-[16px] text-slate-700 font-medium leading-relaxed flex items-start gap-2">
                        <MapPin size={18} className="text-slate-400 mt-1 shrink-0" />
                        {marker.address}
                      </p>
                    </div>

                    <button 
                      className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold text-[17px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-lg shadow-slate-900/20"
                      onClick={() => handleDirections(marker.lat, marker.lng, marker.address)}
                    >
                      <Navigation size={20} />
                      이곳으로 길안내 시작
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Action Button (Add Recipient) */}
      <button
        onClick={() => { setEditingRecipient(null); setIsModalOpen(true); }}
        className="absolute bottom-[100px] right-6 z-40 w-16 h-16 bg-teal-600 text-white rounded-full flex items-center justify-center shadow-[0_8px_30px_rgba(13,148,136,0.4)] active:scale-90 transition-transform"
        aria-label="어르신 추가"
      >
        <Plus size={32} strokeWidth={2.5} />
      </button>

      {/* Map Marker Popup */}
      {selectedRecipient && activeTab === 'map' && (
        <div className="absolute bottom-[100px] left-4 right-4 z-30 bg-white rounded-[24px] shadow-[0_20px_40px_rgb(0,0,0,0.12)] p-6 border border-slate-100 animate-fade-in-up">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                {selectedRecipient.name} 어르신
              </h3>
              <div className="flex items-center gap-1.5 text-teal-600 font-bold mt-2 text-[16px]">
                <Clock size={18} />
                {selectedRecipient.visit_time.substring(0, 5)} 방문 예정
              </div>
            </div>
            <button onClick={() => setSelectedRecipient(null)} className="p-2 text-slate-400 bg-slate-50 rounded-full active:bg-slate-200">
              <X size={20} />
            </button>
          </div>
          <p className="text-[16px] text-slate-600 font-medium mb-5 bg-slate-50 p-4 rounded-2xl leading-relaxed">
            {selectedRecipient.address}
          </p>
          <button 
            className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold text-[17px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-lg shadow-slate-900/20"
            onClick={() => handleDirections(selectedRecipient.lat, selectedRecipient.lng, selectedRecipient.address)}
          >
            <Navigation size={20} />
            길안내 시작
          </button>
        </div>
      )}

      {/* Redesigned Bottom Navigation */}
      <nav className="bg-white/90 backdrop-blur-lg border-t border-slate-100 flex p-2 pb-safe z-50 absolute bottom-0 w-full shadow-[0_-10px_40px_rgba(0,0,0,0.05)] rounded-t-[32px]">
        <button
          className={`flex-1 flex flex-col items-center justify-center py-3 gap-1.5 rounded-2xl transition-all ${activeTab === 'map' ? 'text-teal-600' : 'text-slate-400'}`}
          onClick={() => setActiveTab('map')}
          aria-selected={activeTab === 'map'}
          role="tab"
        >
          <div className={`p-1.5 rounded-xl transition-colors ${activeTab === 'map' ? 'bg-teal-50' : ''}`}>
            <MapPin size={24} strokeWidth={activeTab === 'map' ? 2.5 : 2} />
          </div>
          <span className={`text-[13px] ${activeTab === 'map' ? 'font-bold' : 'font-medium'}`}>지도 보기</span>
        </button>
        <button
          className={`flex-1 flex flex-col items-center justify-center py-3 gap-1.5 rounded-2xl transition-all ${activeTab === 'list' ? 'text-teal-600' : 'text-slate-400'}`}
          onClick={() => setActiveTab('list')}
          aria-selected={activeTab === 'list'}
          role="tab"
        >
          <div className={`p-1.5 rounded-xl transition-colors ${activeTab === 'list' ? 'bg-teal-50' : ''}`}>
            <List size={24} strokeWidth={activeTab === 'list' ? 2.5 : 2} />
          </div>
          <span className={`text-[13px] ${activeTab === 'list' ? 'font-bold' : 'font-medium'}`}>명단 보기</span>
        </button>
      </nav>

      <RecipientModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={() => {
          setIsModalOpen(false);
          fetchMarkers();
        }}
        recipientToEdit={editingRecipient}
      />
    </main>
  );
}
"""

with open(page_path, "w", encoding="utf-8") as f:
    f.write(new_code)

print("Page rewritten")
