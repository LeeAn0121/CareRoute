'use client';
import { useState, useEffect, useRef } from 'react';
import { Container, NaverMap, Marker } from 'react-naver-maps';
import { IconMapPin, IconList, IconPlus, IconNavigation, IconClock, IconUser, IconDownload, IconShare, IconX, IconChevronRight, IconCheck, IconPencil, IconTrash } from '@tabler/icons-react';
import { supabase } from '@/lib/supabase';
import { Select, MenuItem, FormControl, Button, Fab, BottomNavigation, BottomNavigationAction, Paper, Typography, Card, CardContent, Drawer, Box, Chip, IconButton } from '@mui/material';
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
  notes?: string | null;
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

function MainApp() {
  const handleMyLocation = () => {
    if (!navigator.geolocation) {
      alert("GPS를 지원하지 않는 기기입니다.");
      return;
    }
    navigator.geolocation.getCurrentPosition((position) => {
      setMapCenter({ lat: position.coords.latitude, lng: position.coords.longitude });
      setMapZoom(17);
    }, (error) => {
      alert("위치 정보를 가져올 수 없습니다. GPS가 켜져 있는지 확인해주세요.");
    });
  };

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
  const [mapZoom, setMapZoom] = useState(15);
  const [showRegions, setShowRegions] = useState(false);
  const mapRef = useRef<any>(null);
  const regionsLoaded = useRef(false);
  const regionLabelsRef = useRef<any[]>([]);

  // Load Regions GeoJSON
  useEffect(() => {
    if (showRegions && mapRef.current && window.naver && !regionsLoaded.current) {
      regionsLoaded.current = true;
      const map = mapRef.current;
      fetch(`https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2013/json/skorea_municipalities_geo_simple.json`)
        .then(r => r.json())
        .then(geojson => {
          map.data.addGeoJson(geojson);
          
          // 이름 라벨 마커 생성 (시군구)
          if (geojson.features) {
            geojson.features.forEach((feature: any) => {
              const name = feature.properties?.name;
              const coords = feature.geometry.coordinates;
              if (name && coords) {
                // Polygon 중심점 대략 계산
                let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
                
                // MultiPolygon or Polygon handling
                const poly = feature.geometry.type === 'MultiPolygon' ? coords[0][0] : coords[0];
                
                poly.forEach((coord: number[]) => {
                  if (coord[1] < minLat) minLat = coord[1];
                  if (coord[1] > maxLat) maxLat = coord[1];
                  if (coord[0] < minLng) minLng = coord[0];
                  if (coord[0] > maxLng) maxLng = coord[0];
                });
                
                const centerLat = (minLat + maxLat) / 2;
                const centerLng = (minLng + maxLng) / 2;
                
                const marker = new window.naver.maps.Marker({
                  position: new window.naver.maps.LatLng(centerLat, centerLng),
                  map: map,
                  icon: {
                    content: `<div style="padding: 3px 8px; background: rgba(13, 148, 136, 0.9); color: white; border-radius: 12px; font-size: 12px; font-weight: bold; border: 1.5px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.2); white-space: nowrap;">${name}</div>`,
                    anchor: new window.naver.maps.Point(20, 15)
                  }
                });
                regionLabelsRef.current.push(marker);
              }
            });
          }
        });
      map.data.setStyle((feature: any) => {
        return {
          fillColor: '#0d9488',
          fillOpacity: 0.1,
          strokeColor: '#0d9488',
          strokeWeight: 2,
          strokeOpacity: 0.6,
          visible: true
        };
      });
    } else if (mapRef.current && window.naver) {
      mapRef.current.data.setStyle({ visible: showRegions });
      // 토글 시 라벨 마커 보이기/숨기기
      regionLabelsRef.current.forEach(marker => {
        marker.setMap(showRegions ? mapRef.current : null);
      });
    }
  }, [showRegions]);

  useEffect(() => {
    if (selectedDong) {
      const firstElder = markers.find(m => m.dong === selectedDong);
      if (firstElder) {
        setMapCenter({ lat: firstElder.lat, lng: firstElder.lng });
        setMapZoom(15);
      }
    }
  }, [selectedDong]);



  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true); // default true to hide initially
  
  // Notification Logic
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const checkAlarms = () => {
      const now = new Date();
      const currentYMD = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const currentHM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      
      markers.forEach(marker => {
        if (marker.notes === currentYMD && marker.visit_time.substring(0, 5) === currentHM) {
          const alarmKey = `alarm_${marker.id}_${currentYMD}_${currentHM}`;
          if (!localStorage.getItem(alarmKey)) {
            localStorage.setItem(alarmKey, 'true'); // Prevent duplicate fires
            
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('케어루트 알림 🚨', {
                body: `${marker.name} 어르신 방문 예정 시간입니다! (${marker.address})`,
                icon: '/CareRoute/icon-192.png'
              });
            } else {
              alert(`🚨 [케어루트 알림] ${marker.name} 어르신 방문 시간입니다!`);
            }
          }
        }
      });
    };

    const intervalId = setInterval(checkAlarms, 30000); // Check every 30 seconds
    return () => clearInterval(intervalId);
  }, [markers]);

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
      if (typeof window !== 'undefined' && window.naver && window.naver.maps && window.naver.maps.LatLngBounds && window.naver.maps.Map) {
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
              <IconDownload size={20} className="text-white" />
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
              <IconX size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Floating Header */}
      <header className="absolute top-0 left-0 right-0 z-20 flex flex-col gap-2">
        <Paper elevation={0} sx={{ p: 2, borderRadius: 0, borderBottom: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
          <Typography variant="h5" component="div" sx={{ fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, letterSpacing: '-0.5px' }}>
            <Box component="span" sx={{ width: 36, height: 36, bgcolor: '#0d9488', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.3)' }}>
              <IconMapPin size={20} color="white" />
            </Box>
            케어루트
          </Typography>
          
          <div className="flex gap-2">
            <FormControl size="small" sx={{ flex: 1, bgcolor: '#f8fafc', borderRadius: 1 }}>
              <Select
                native
                value={selectedSido}
                onChange={(e) => setSelectedSido(e.target.value)}
                sx={{ borderRadius: 1, fontWeight: 700, fontSize: '14px', '& fieldset': { border: 'none' }, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
              >
                <option value="">시/도</option>
                {sidos.map(sido => <option key={sido.code} value={sido.code}>{sido.name}</option>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ flex: 1, bgcolor: '#f8fafc', borderRadius: 1 }} disabled={!selectedSido}>
              <Select
                native
                value={selectedSigungu}
                onChange={(e) => setSelectedSigungu(e.target.value)}
                sx={{ borderRadius: 1, fontWeight: 700, fontSize: '14px', '& fieldset': { border: 'none' }, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
              >
                <option value="">시/군/구</option>
                {sigungus.map(sig => <option key={sig.code} value={sig.code}>{sig.name.split(' ').pop()}</option>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ flex: 1, bgcolor: '#f8fafc', borderRadius: 1 }} disabled={!selectedSigungu}>
              <Select
                native
                value={selectedDong}
                onChange={(e) => setSelectedDong(e.target.value)}
                sx={{ borderRadius: 1, fontWeight: 700, fontSize: '14px', '& fieldset': { border: 'none' }, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
              >
                <option value="">동/읍/면</option>
                {dongs.map(dong => <option key={dong.code} value={dong.code}>{dong.name.split(' ').pop()}</option>)}
              </Select>
            </FormControl>
          </div>
        </Paper>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 relative w-full h-full bg-slate-100">
        
        {/* Map View */}
        <div className={`absolute inset-0 top-0 ${activeTab === 'map' ? 'block' : 'hidden'}`}>
          {mapLoaded ? (
            <Container className="w-full h-full">
              <NaverMap
                ref={mapRef}
                defaultCenter={mapCenter}
                center={mapCenter}
                zoom={mapZoom}
                onZoomChanged={(z: number) => setMapZoom(z)}
              >
                {markers.map((marker) => (
                  <Marker
                    key={marker.id}
                    position={{ lat: marker.lat, lng: marker.lng }}
                    onClick={() => setSelectedRecipient(marker)}
                    icon={{
                      content: `
                        <div class="relative flex flex-col items-center justify-center ${selectedRecipient?.id === marker.id ? 'scale-110 z-50' : 'scale-100'} transition-transform duration-300">
                          <div class="relative flex items-center justify-center w-12 h-12">
                            <div class="absolute inset-0 bg-teal-500 rounded-full opacity-30 animate-ping"></div>
                            <div class="relative bg-teal-600 text-white rounded-full p-2.5 shadow-[0_4px_12px_rgba(13,148,136,0.5)] border-2 border-white">
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            </div>
                          </div>
                          <div class="mt-1 px-2 py-0.5 bg-white text-slate-700 text-xs font-bold rounded-md shadow-sm border border-slate-200 whitespace-nowrap">
                            ${marker.name} 어르신
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
                <IconMapPin size={40} className="text-slate-300" />
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
                  <IconUser size={32} className="text-slate-300" />
                </div>
                <p className="font-bold text-lg text-slate-500">이 지역엔 등록된 어르신이 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {markers.sort((a,b) => a.visit_time.localeCompare(b.visit_time)).map((marker) => (
                  <Card 
                    key={marker.id} 
                    elevation={0} 
                    sx={{ borderRadius: 1, mb: 2, border: '1px solid #e2e8f0', cursor: 'pointer' }}
                    onClick={() => {
                      setMapCenter({ lat: marker.lat, lng: marker.lng });
                      setMapZoom(17); // Zoom in deeply
                      setActiveTab('map'); // Switch to map tab
                      setSelectedRecipient(marker);
                    }}
                  >
                    <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                          <Box sx={{ width: 56, height: 56, bgcolor: '#f0fdfa', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <IconUser size={28} color="#0d9488" />
                          </Box>
                          <Box>
                            <Typography variant="h6" component="div" sx={{ fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px' }}>
                              {marker.name} 어르신
                            </Typography>
                            <Chip 
                              icon={<IconClock size={14} />} 
                              label={`${marker.notes ? marker.notes.substring(5) + ' ' : ''}${marker.visit_time.substring(0, 5) === '00:00' ? '시간 미정' : marker.visit_time.substring(0, 5) + ' 방문'}`} 
                              size="small" 
                              sx={{ mt: 0.5, bgcolor: '#ccfbf1', color: '#0f766e', fontWeight: 800, borderRadius: 1.5, '& .MuiChip-icon': { color: '#0f766e' } }} 
                            />
                          </Box>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <IconButton onClick={() => { setEditingRecipient(marker); setIsModalOpen(true); }} size="small" sx={{ bgcolor: '#f8fafc' }}>
                            <IconPencil size={18} />
                          </IconButton>
                          <IconButton onClick={() => handleDelete(marker.id)} size="small" sx={{ bgcolor: '#fef2f2', color: '#ef4444' }}>
                            <IconTrash size={18} />
                          </IconButton>
                        </Box>
                      </Box>
                      
                      <Paper elevation={0} sx={{ bgcolor: '#f8fafc', p: 2, borderRadius: 1, mb: 2.5, display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                        <IconMapPin size={20} color="#94a3b8" style={{ marginTop: 2, flexShrink: 0 }} />
                        <Typography variant="body1" sx={{ fontWeight: 600, color: '#475569', lineHeight: 1.5 }}>
                          {marker.address}
                        </Typography>
                      </Paper>

                      <Button
                        variant="contained"
                        fullWidth
                        size="large"
                        startIcon={<IconNavigation />}
                        onClick={() => handleDirections(marker.lat, marker.lng, marker.address)}
                        sx={{ py: 1.5, borderRadius: 1, fontSize: '1.05rem', fontWeight: 800, bgcolor: '#0f172a', '&:hover': { bgcolor: '#1e293b' }, boxShadow: '0 4px 14px rgba(15,23,42,0.2)' }}
                      >
                        길안내 시작
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Action Button (Add Recipient) */}
      {/* 행정구역 토글 버튼 */}
      <Fab
        size="small"
        onClick={() => setShowRegions(!showRegions)}
        sx={{ position: 'absolute', top: 120, right: 16, zIndex: 40, bgcolor: showRegions ? '#0d9488' : '#ffffff', color: showRegions ? '#ffffff' : '#475569', borderRadius: 2 }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
      </Fab>

      {/* 확대/축소 버튼 */}
      <div className="absolute top-[180px] right-4 z-40 flex flex-col gap-2">
        <Fab size="small" onClick={() => setMapZoom(prev => Math.min(prev + 1, 21))} sx={{ bgcolor: '#ffffff', borderRadius: 2 }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </Fab>
        <Fab size="small" onClick={() => setMapZoom(prev => Math.max(prev - 1, 6))} sx={{ bgcolor: '#ffffff', borderRadius: 2 }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </Fab>
        
        {/* 내 위치 버튼 */}
        <Fab size="small" onClick={handleMyLocation} sx={{ bgcolor: '#ffffff', borderRadius: 2, mt: 1 }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19 12h2"></path><path d="M3 12h2"></path><path d="M12 3v2"></path><path d="M12 19v2"></path><circle cx="12" cy="12" r="8"></circle></svg>
        </Fab>
      </div>

      <Fab 
        color="primary" 
        aria-label="어르신 추가" 
        onClick={() => { setEditingRecipient(null); setIsModalOpen(true); }}
        sx={{ position: 'absolute', bottom: 100, right: 24, zIndex: 40, width: 56, height: 56, borderRadius: 3, boxShadow: '0 4px 12px rgba(13,148,136,0.3)' }}
      >
        <IconPlus size={32} strokeWidth={2.5} />
      </Fab>

      {/* Map Marker Popup */}
      <Drawer
        anchor="bottom"
        open={Boolean(selectedRecipient && activeTab === 'map')}
        onClose={() => setSelectedRecipient(null)}
        sx={{ '& .MuiDrawer-paper': { borderTopLeftRadius: 12, borderTopRightRadius: 12, p: 3, pb: 14 } }}
        ModalProps={{ keepMounted: true }}
      >
        {selectedRecipient && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Typography variant="h5" component="div" sx={{ fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px' }}>
                    {selectedRecipient.name} 어르신
                  </Typography>
                  <IconButton onClick={() => { setIsModalOpen(true); setEditingRecipient(selectedRecipient); }} size="small" sx={{ bgcolor: '#f8fafc' }}>
                    <IconPencil size={18} />
                  </IconButton>
                  <IconButton onClick={() => handleDelete(selectedRecipient.id)} size="small" sx={{ bgcolor: '#fef2f2', color: '#ef4444' }}>
                    <IconTrash size={18} />
                  </IconButton>
                </Box>
                <Chip 
                  icon={<IconClock size={16} />} 
                  label={`${selectedRecipient.notes ? selectedRecipient.notes.substring(5) + ' ' : ''}${selectedRecipient.visit_time.substring(0, 5) === '00:00' ? '시간 미정' : selectedRecipient.visit_time.substring(0, 5) + ' 방문'}`} 
                  color="primary" 
                  variant="outlined" 
                  size="small" 
                  sx={{ mt: 1, fontWeight: 700, borderRadius: 2 }} 
                />
              </Box>
              <IconButton onClick={() => setSelectedRecipient(null)} sx={{ bgcolor: '#f1f5f9' }}>
                <IconX size={20} />
              </IconButton>
            </Box>
            <Paper elevation={0} sx={{ bgcolor: '#f8fafc', p: 2.5, borderRadius: 2, mb: 3 }}>
              <Typography variant="body1" sx={{ fontWeight: 600, color: '#475569', lineHeight: 1.6 }}>
                {selectedRecipient.address}
              </Typography>
            </Paper>
            <Button
              variant="contained"
              fullWidth
              size="large"
              startIcon={<IconNavigation />}
              onClick={() => handleDirections(selectedRecipient.lat, selectedRecipient.lng, selectedRecipient.address)}
              sx={{ py: 2, borderRadius: 2, fontSize: '1.1rem', fontWeight: 800, bgcolor: '#0f172a', '&:hover': { bgcolor: '#1e293b' }, boxShadow: '0 8px 24px rgba(15,23,42,0.3)' }}
            >
              이곳으로 길안내 시작
            </Button>
          </Box>
        )}
      </Drawer>

      {/* Redesigned Bottom Navigation */}
      <Paper sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 50, borderRadius: '32px 32px 0 0', overflow: 'hidden', boxShadow: '0 -10px 40px rgba(0,0,0,0.08)' }} elevation={8}>
        <BottomNavigation
          showLabels
          value={activeTab}
          onChange={(event, newValue) => setActiveTab(newValue)}
          sx={{ height: 80, pb: 'env(safe-area-inset-bottom)' }}
        >
          <BottomNavigationAction 
            label="지도 보기" 
            value="map" 
            icon={<IconMapPin size={26} strokeWidth={activeTab === 'map' ? 2.5 : 2} />} 
            sx={{ '&.Mui-selected': { color: '#0d9488', fontWeight: 800 } }}
          />
          <BottomNavigationAction 
            label="명단 보기" 
            value="list" 
            icon={<IconList size={26} strokeWidth={activeTab === 'list' ? 2.5 : 2} />} 
            sx={{ '&.Mui-selected': { color: '#0d9488', fontWeight: 800 } }}
          />
        </BottomNavigation>
      </Paper>

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

import dynamic from 'next/dynamic';
export default dynamic(() => Promise.resolve(MainApp), { ssr: false });
