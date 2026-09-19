'use client';
import { useState, useEffect } from 'react';
import { Container, NaverMap, Marker } from 'react-naver-maps';
import { MapPin, List, UserPlus, Navigation, Clock, User, Pencil, Trash2 } from 'lucide-react';
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
  const [mapCenter, setMapCenter] = useState({ lat: 37.5666, lng: 126.9784 });
  const [sidos, setSidos] = useState<RegCode[]>([]);
  const [sigungus, setSigungus] = useState<RegCode[]>([]);
  const [dongs, setDongs] = useState<RegCode[]>([]);

  const [selectedSido, setSelectedSido] = useState<string>('');
  const [selectedSigungu, setSelectedSigungu] = useState<string>('');
  const [selectedDong, setSelectedDong] = useState<string>('');

  const [markers, setMarkers] = useState<Recipient[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<Recipient | null>(null);

  // 모달 상태
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState<Recipient | null>(null);

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
    if (!selectedSido) {
      setSigungus([]);
      setSelectedSigungu('');
      return;
    }
    const pattern = selectedSido.substring(0, 2) + '*00000';
    fetch(`https://grpc-proxy-server-mkvo6j4wsq-du.a.run.app/v1/regcodes?regcode_pattern=${pattern}&is_ignore_zero=true`)
      .then(res => res.json())
      .then(data => {
        const list = (data.regcodes || []).filter((item: RegCode) => item.code !== selectedSido);
        setSigungus(list);
        setSelectedSigungu('');
      });
  }, [selectedSido]);

  useEffect(() => {
    if (!selectedSigungu) {
      setDongs([]);
      setSelectedDong('');
      return;
    }
    const finalPattern = selectedSigungu.substring(0, 5) + '*';
    fetch(`https://grpc-proxy-server-mkvo6j4wsq-du.a.run.app/v1/regcodes?regcode_pattern=${finalPattern}&is_ignore_zero=true`)
      .then(res => res.json())
      .then(data => {
        const list = (data.regcodes || []).filter((item: RegCode) => item.code !== selectedSigungu);
        setDongs(list);
        setSelectedDong('');
      });
  }, [selectedSigungu]);

  useEffect(() => {
    let addressToSearch = '';
    if (selectedDong) {
      addressToSearch = dongs.find(d => d.code === selectedDong)?.name || '';
    } else if (selectedSigungu) {
      addressToSearch = sigungus.find(s => s.code === selectedSigungu)?.name || '';
    } else if (selectedSido) {
      addressToSearch = sidos.find(s => s.code === selectedSido)?.name || '';
    }

    if (addressToSearch && window.naver && window.naver.maps && window.naver.maps.Service) {
      // @ts-ignore
      window.naver.maps.Service.geocode({ query: addressToSearch }, function(status, response) {
        // @ts-ignore
        if (status === window.naver.maps.Service.Status.OK) {
          const item = response.v2.addresses[0];
          if (item) {
            setMapCenter({ lat: parseFloat(item.y), lng: parseFloat(item.x) });
          }
        }
      });
    }
    setSelectedRecipient(null);
  }, [selectedSido, selectedSigungu, selectedDong, sidos, sigungus, dongs]);

  const getShortName = (fullName: string) => {
    const parts = fullName.split(' ');
    return parts[parts.length - 1];
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말로 삭제하시겠습니까?')) return;
    
    const { error } = await supabase.from('recipients').delete().eq('id', id);
    if (error) {
      alert('삭제 중 오류가 발생했습니다.');
      console.error(error);
    } else {
      setSelectedRecipient(null);
      fetchMarkers();
    }
  };

  const [activeTab, setActiveTab] = useState<'map' | 'list'>('map');

  const handleDirections = (lat: number, lng: number, name: string) => {
    // 네이버 지도 길찾기 URL (PC/모바일 모두 호환성 좋은 방식)
    const url = `https://m.map.naver.com/route.nhn?menu=route&ename=${encodeURIComponent(name)}&ex=${lng}&ey=${lat}&pathType=0&showMap=true`;
    window.open(url, '_blank');
  };


  return (
    <main className="flex-1 flex flex-col h-[100dvh] relative bg-slate-50 font-sans">
      {/* Top Header / Search Area (Only show on map and list) */}
      {(activeTab === 'map' || activeTab === 'list') && (
        <header className="bg-white shadow-md rounded-b-3xl px-6 pt-safe-top pb-6 z-20 absolute top-0 w-full">
          <div className="flex items-center justify-between mb-4 mt-2">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight" aria-label="케어루트 홈">케어루트</h1>
            <button 
              onClick={() => {
                setEditingRecipient(null);
                setIsModalOpen(true);
              }}
              className="p-3 bg-teal-100 text-teal-700 rounded-full hover:bg-teal-200 transition-colors focus:ring-4 focus:ring-teal-500/30 active:bg-teal-300 shadow-sm" aria-label="수급자 추가"
            >
              <UserPlus size={22} />
            </button>
          </div>
          
          <div className="flex gap-2">
            <select
              className="flex-1 px-4 py-3 text-base font-bold border-2 border-slate-300 rounded-xl bg-white text-slate-800 focus:outline-none focus:ring-4 focus:ring-teal-500/30 focus:border-teal-600 appearance-none transition-all shadow-sm" aria-label="시/도 선택"
              value={selectedSido}
              onChange={(e) => setSelectedSido(e.target.value)}
            >
              <option value="">시/도</option>
              {sidos.map((d) => (
                <option key={d.code} value={d.code}>{getShortName(d.name)}</option>
              ))}
            </select>

            <select
              className="flex-1 px-4 py-3 text-base font-bold border-2 border-slate-300 rounded-xl bg-white text-slate-800 focus:outline-none focus:ring-4 focus:ring-teal-500/30 focus:border-teal-600 appearance-none disabled:opacity-50 disabled:bg-slate-100 transition-all shadow-sm" aria-label="지역 선택"
              value={selectedSigungu}
              onChange={(e) => setSelectedSigungu(e.target.value)}
              disabled={!selectedSido}
            >
              <option value="">시/군/구</option>
              {sigungus.map((d) => (
                <option key={d.code} value={d.code}>{getShortName(d.name)}</option>
              ))}
            </select>

            <select
              className="flex-1 px-4 py-3 text-base font-bold border-2 border-slate-300 rounded-xl bg-white text-slate-800 focus:outline-none focus:ring-4 focus:ring-teal-500/30 focus:border-teal-600 appearance-none disabled:opacity-50 disabled:bg-slate-100 transition-all shadow-sm" aria-label="지역 선택"
              value={selectedDong}
              onChange={(e) => setSelectedDong(e.target.value)}
              disabled={!selectedSigungu}
            >
              <option value="">읍/면/동(전체)</option>
              {dongs.map((d) => (
                <option key={d.code} value={d.code}>{getShortName(d.name)}</option>
              ))}
            </select>
          </div>
        </header>
      )}

      {/* Main Content Area */}
      <div className="flex-1 w-full bg-slate-100 relative overflow-hidden flex flex-col pt-[140px]">
        
        {/* Map View (Always mounted, visually hidden if not active to keep script loaded) */}
        <div className={`absolute inset-0 top-0 ${activeTab === 'map' ? 'block' : 'hidden'}`}>
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
                      <div class="relative flex items-center justify-center w-10 h-10 ${selectedRecipient?.id === marker.id ? 'scale-110 z-50' : 'scale-100'} transition-transform duration-200">
                        <div class="absolute inset-0 bg-teal-500 rounded-full opacity-20 animate-ping"></div>
                        <div class="relative bg-teal-600 text-white rounded-full p-2 shadow-lg border-2 border-white">
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        </div>
                      </div>
                    `,
                    anchor: { x: 20, y: 20 }
                  }}
                />
              ))}
            </NaverMap>
          </Container>
        </div>

        {activeTab === 'list' && (
          <div className="flex-1 overflow-y-auto px-5 pb-10">
            {markers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <User size={48} className="mb-4 opacity-20" />
                <p>선택한 지역에 수급자가 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {markers.sort((a,b) => a.visit_time.localeCompare(b.visit_time)).map((marker) => (
                  <div key={marker.id} className="bg-white rounded-2xl shadow-sm p-5 border border-slate-200">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                          <User size={18} className="text-teal-600" />
                          {marker.name} 어르신
                        </h2>
                        <p className="text-slate-600 text-base mt-2 font-medium leading-relaxed">{marker.address}</p>
                      </div>
                      <div className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 whitespace-nowrap">
                        <Clock size={12} />
                        {marker.visit_time.substring(0,5)}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
                      <button 
                        onClick={() => {
                          setMapCenter({ lat: marker.lat, lng: marker.lng });
                          setSelectedRecipient(marker);
                          setActiveTab('map');
                        }}
                        className="flex-1 bg-slate-200 text-slate-800 py-3 rounded-xl text-base font-bold hover:bg-slate-300 active:bg-slate-400 transition-colors focus:ring-4 focus:ring-slate-500/30"
                        aria-label={`${marker.name} 어르신 위치 지도로 보기`}
                      >
                        지도에서 보기
                      </button>
                      <button 
                        className="flex-1 bg-teal-600 text-white py-3 rounded-xl text-base font-bold hover:bg-teal-700 active:bg-teal-800 transition-colors focus:ring-4 focus:ring-teal-500/30 shadow-md"
                        onClick={() => handleDirections(marker.lat, marker.lng, marker.address)}
                        aria-label={`${marker.name} 어르신 길찾기`}
                      >
                        길찾기
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}


      </div>

      {/* Floating Card for Selected Recipient (Only on map) */}
      {activeTab === 'map' && selectedRecipient && (
        <div className="absolute bottom-24 left-4 right-4 z-20 animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="bg-white rounded-2xl shadow-xl p-5 border border-slate-100">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <User size={20} className="text-teal-600" />
                  {selectedRecipient.name} 어르신
                </h2>
                <p className="text-slate-500 text-sm mt-1">{selectedRecipient.address}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
                  <Clock size={14} />
                  {selectedRecipient.visit_time.substring(0,5)}
                </div>
                <div className="flex gap-2 text-slate-400">
                  <button 
                    onClick={() => {
                      setEditingRecipient(selectedRecipient);
                      setIsModalOpen(true);
                    }}
                    className="p-1.5 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                  >
                    <Pencil size={16} />
                  </button>
                  <button 
                    onClick={() => handleDelete(selectedRecipient.id)}
                    className="p-1.5 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
            <button 
              className="w-full mt-2 bg-slate-800 hover:bg-slate-700 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
              onClick={() => handleDirections(selectedRecipient.lat, selectedRecipient.lng, selectedRecipient.address)}
            >
              <Navigation size={18} />
              길찾기
            </button>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="bg-white border-t border-slate-100 flex justify-around p-2 pb-safe z-30 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
        <button 
          onClick={() => setActiveTab('map')}
          className={`flex flex-col items-center justify-center w-full py-2 transition-colors ${activeTab === 'map' ? 'text-teal-600' : 'text-slate-400 hover:text-teal-500'}`}
        >
          <div className={`${activeTab === 'map' ? 'bg-teal-50' : ''} p-1.5 rounded-full mb-1`}>
            <MapPin size={22} strokeWidth={activeTab === 'map' ? 2.5 : 2} />
          </div>
          <span className={`text-[10px] ${activeTab === 'map' ? 'font-bold' : 'font-medium'}`}>지도</span>
        </button>
        <button 
          onClick={() => setActiveTab('list')}
          className={`flex flex-col items-center justify-center w-full py-2 transition-colors ${activeTab === 'list' ? 'text-teal-600' : 'text-slate-400 hover:text-teal-500'}`}
        >
          <div className={`${activeTab === 'list' ? 'bg-teal-50' : ''} p-1.5 rounded-full mb-1`}>
            <List size={22} strokeWidth={activeTab === 'list' ? 2.5 : 2} />
          </div>
          <span className={`text-[10px] ${activeTab === 'list' ? 'font-bold' : 'font-medium'}`}>목록</span>
        </button>

      </nav>

      <RecipientModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          setSelectedRecipient(null);
          fetchMarkers();
        }}
        recipientToEdit={editingRecipient}
      />
    </main>
  );
}
