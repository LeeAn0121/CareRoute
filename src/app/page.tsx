'use client';
import { useState, useEffect, useRef } from 'react';
import { Container, NaverMap, Marker } from 'react-naver-maps';
import { IconMapPin, IconList, IconPlus, IconNavigation, IconClock, IconUser, IconDownload, IconShare, IconX, IconSearch, IconChevronRight, IconCheck, IconPencil, IconTrash } from '@tabler/icons-react';
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


// GeoJSON 밎 마커 캐시
const geoCache: any = { sido: null, sigungu: null, dong: null };
const labelCache: any = { sido: [], sigungu: [], dong: [] };
let currentRenderedLevel = ''; // Track currently rendered level to prevent re-rendering

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
    }, {
      enableHighAccuracy: false,
      maximumAge: 60000,
      timeout: 5000
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
  const [searchQuery, setSearchQuery] = useState('');
  const mapRef = useRef<any>(null);
  const regionsLoaded = useRef(false);
  const regionLabelsRef = useRef<any[]>([]);

  // Programmatic Pan & Zoom (React State -> Map API)
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    
    // 현재 지도의 실제 상태
    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();
    
    // React State와 실제 지도 상태가 다를 때만 이동 (유저가 직접 드래그한 것을 되돌리지 않기 위해)
    const latDiff = Math.abs(currentCenter.y - mapCenter.lat);
    const lngDiff = Math.abs(currentCenter.x - mapCenter.lng);
    
    if (latDiff > 0.0001 || lngDiff > 0.0001) {
      map.panTo(mapCenter);
    }
    
    if (currentZoom !== mapZoom) {
      map.setZoom(mapZoom);
    }
  }, [mapCenter, mapZoom]);

  // Semantic Zoom (시도 -> 시군구 -> 동)
  useEffect(() => {
    if (!mapRef.current || !window.naver) return;
    const map = mapRef.current;

    if (!showRegions) {
      map.data.setStyle({ visible: false });
      ['sido', 'sigungu', 'dong'].forEach(lvl => {
        labelCache[lvl].forEach((m: any) => m.setMap(null));
      });
      currentRenderedLevel = '';
      return;
    }

    const level = mapZoom <= 10 ? 'sido' : (mapZoom <= 13 ? 'sigungu' : 'dong');
    
    // 🔥 Optimization: Don't re-render if the level hasn't changed!
    if (currentRenderedLevel === level) return;
    
    const urlMap: any = {
      sido: 'https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2013/json/skorea_provinces_geo_simple.json',
      sigungu: 'https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2013/json/skorea_municipalities_geo_simple.json',
      dong: 'https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2013/json/skorea_submunicipalities_geo_simple.json'
    };

    const drawLevel = (lvl: string) => {
      currentRenderedLevel = lvl;
      // 1. 기존 데이터 모두 지우기
      map.data.getAllFeature().forEach((f: any) => map.data.removeFeature(f));
      
      // 2. 새 데이터 그리기 (화면 근처 폴리곤만 필터링)
      const bounds = map.getBounds();
      // 약 10km 반경 (대략 0.1도) 여유 버퍼
      const minLat = bounds.minY() - 0.15;
      const maxLat = bounds.maxY() + 0.15;
      const minLng = bounds.minX() - 0.15;
      const maxLng = bounds.maxX() + 0.15;
      
      const filteredFeatures = lvl === 'dong' ? geoCache[lvl].features.filter((f: any) => {
         const lat = f.properties?._centerLat;
         const lng = f.properties?._centerLng;
         if (lat && lng) {
            return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
         }
         return true;
      }) : geoCache[lvl].features;
      
      const filteredGeoJson = { ...geoCache[lvl], features: filteredFeatures };
      map.data.addGeoJson(filteredGeoJson);
      map.data.setStyle({
        fillColor: lvl === 'dong' ? '#0ea5e9' : (lvl === 'sigungu' ? '#0d9488' : '#8b5cf6'),
        fillOpacity: 0.1,
        strokeColor: lvl === 'dong' ? '#0ea5e9' : (lvl === 'sigungu' ? '#0d9488' : '#8b5cf6'),
        strokeWeight: lvl === 'dong' ? 1 : 2,
        strokeOpacity: 0.6,
        visible: true
      });

      // 3. 마커 렌더링 최적화 (현재 뷰포트 내의 마커만 표시)
      ['sido', 'sigungu', 'dong'].forEach(l => {
        labelCache[l].forEach((m: any) => {
          if (l === lvl && bounds.hasLatLng(m.getPosition())) {
            if (!m.getMap()) m.setMap(map);
          } else {
            if (m.getMap()) m.setMap(null);
          }
        });
      });
    };

    // 폴리곤 클릭 시 해당 구역으로 드롭다운 자동 필터링 (Reverse Geocoding)
    if (!window.naver.maps.Event.hasListener(map.data, 'click')) {
      window.naver.maps.Event.addListener(map.data, 'click', (e: any) => {
        const lat = e.feature.properties?._centerLat;
        const lng = e.feature.properties?._centerLng;
        if (!lat || !lng || !window.naver.maps.Service) return;

        // @ts-ignore
        window.naver.maps.Service.reverseGeocode({
          coords: new window.naver.maps.LatLng(lat, lng),
          orders: [window.naver.maps.Service.OrderType.LEGAL_CODE].join(',')
        }, function(status: any, response: any) {
          if (status === 200 && response.v2.results.length > 0) {
            const bcode = response.v2.results[0].code.id; // 10자리 법정동 코드
            if (bcode && bcode.length === 10) {
              const sido = bcode.substring(0, 2) + '00000000';
              const sigungu = bcode.substring(0, 5) + '00000';
              const dong = bcode;
              
              // 현재 보여지는 줌 레벨에 따라 드롭다운 세팅 다르게
              if (currentRenderedLevel === 'sido') {
                setSelectedSido(sido);
                setSelectedSigungu('');
                setSelectedDong('');
              } else if (currentRenderedLevel === 'sigungu') {
                setSelectedSido(sido);
                // 약간의 딜레이를 주어 Sido가 먼저 세팅되게 함 (목록 갱신을 위해)
                setTimeout(() => setSelectedSigungu(sigungu), 100);
                setSelectedDong('');
              } else {
                setSelectedSido(sido);
                setTimeout(() => setSelectedSigungu(sigungu), 100);
                setTimeout(() => setSelectedDong(dong), 200);
              }
            }
          }
        });
      });
    }

    // 지도 이동/확대 시 화면에 보이는 마커만 업데이트 (최적화)
    if (!window.naver.maps.Event.hasListener(map, 'idle')) {
      window.naver.maps.Event.addListener(map, 'idle', () => {
        if (!showRegions || !currentRenderedLevel) return;
        const bounds = map.getBounds();
        
        // 줌 레벨 변동 없이 패닝만 일어났을 때도 폴리곤 채우기
        const minLat = bounds.minY() - 0.15;
        const maxLat = bounds.maxY() + 0.15;
        const minLng = bounds.minX() - 0.15;
        const maxLng = bounds.maxX() + 0.15;
        
        // 확대/축소 및 이동 추적 (깜빡임 방지를 위해 애니메이션 종료 후 한 번만 상태 업데이트)
        const currentZoom = map.getZoom();
        if (currentZoom !== mapZoom) {
            setMapZoom(currentZoom);
        }
        const currentCenter = map.getCenter();
        const latDiff = Math.abs(currentCenter.y - mapCenter.lat);
        const lngDiff = Math.abs(currentCenter.x - mapCenter.lng);
        if (latDiff > 0.0001 || lngDiff > 0.0001) {
            setMapCenter({ lat: currentCenter.y, lng: currentCenter.x });
        }

        // 새로 보여야 할 폴리곤만 추가 (성능 최적화)
        if (geoCache[currentRenderedLevel]) {
           const existingIds = new Set();
           map.data.getAllFeature().forEach((f: any) => {
              if (f.getProperty('name')) existingIds.add(f.getProperty('name'));
           });
           
           const featuresToAdd = currentRenderedLevel === 'dong' ? geoCache[currentRenderedLevel].features.filter((f: any) => {
              const lat = f.properties?._centerLat;
              const lng = f.properties?._centerLng;
              if (lat && lng) {
                 const inBounds = lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
                 return inBounds && !existingIds.has(f.properties.name);
              }
              return false;
           }) : [];
           
           if (featuresToAdd.length > 0) {
              map.data.addGeoJson({ type: "FeatureCollection", features: featuresToAdd });
              map.data.setStyle({
                fillColor: currentRenderedLevel === 'dong' ? '#0ea5e9' : (currentRenderedLevel === 'sigungu' ? '#0d9488' : '#8b5cf6'),
                fillOpacity: 0.1,
                strokeColor: currentRenderedLevel === 'dong' ? '#0ea5e9' : (currentRenderedLevel === 'sigungu' ? '#0d9488' : '#8b5cf6'),
                strokeWeight: currentRenderedLevel === 'dong' ? 1 : 2,
                strokeOpacity: 0.6,
                visible: true
              });
           }
        }
        
        labelCache[currentRenderedLevel].forEach((m: any) => {
          if (bounds.hasLatLng(m.getPosition())) {
            if (!m.getMap()) m.setMap(map);
          } else {
            if (m.getMap()) m.setMap(null);
          }
        });
      });
    }

    if (geoCache[level]) {
      drawLevel(level);
    } else {
      fetch(urlMap[level])
        .then(r => r.json())
        .then(geojson => {
          geoCache[level] = geojson;
          
          if (geojson.features) {
            geojson.features.forEach((feature: any) => {
              const name = feature.properties?.name;
              const coords = feature.geometry?.coordinates;
              if (name && coords) {
                let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
                let valid = false;
                try {
                  const poly = feature.geometry.type === 'MultiPolygon' ? coords[0][0] : coords[0];
                  poly.forEach((coord: number[]) => {
                    if (coord[1] < minLat) minLat = coord[1];
                    if (coord[1] > maxLat) maxLat = coord[1];
                    if (coord[0] < minLng) minLng = coord[0];
                    if (coord[0] > maxLng) maxLng = coord[0];
                    valid = true;
                  });
                } catch (e) {}
                
                if (valid) {
                  const centerLat = (minLat + maxLat) / 2;
                  const centerLng = (minLng + maxLng) / 2;
                  feature.properties._centerLat = centerLat;
                  feature.properties._centerLng = centerLng;
                  const bg = level === 'dong' ? 'rgba(14, 165, 233, 0.85)' : (level === 'sigungu' ? 'rgba(13, 148, 136, 0.95)' : 'rgba(139, 92, 246, 0.95)');
                  const fs = level === 'dong' ? '11px' : '13px';
                  
                  const marker = new window.naver.maps.Marker({
                    position: new window.naver.maps.LatLng(centerLat, centerLng),
                    icon: {
                      content: `<div style="padding: 2px 6px; background: ${bg}; color: white; border-radius: 8px; font-size: ${fs}; font-weight: bold; border: 1px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2); white-space: nowrap; cursor: pointer;">${name}</div>`,
                      anchor: new window.naver.maps.Point(20, 10)
                    }
                  });
                  
                  // 마커(라벨) 클릭 시에도 폴리곤 클릭과 동일하게 동작
                  window.naver.maps.Event.addListener(marker, 'click', () => {
                    // @ts-ignore
                    if (!window.naver.maps.Service) return;
                    // @ts-ignore
                    window.naver.maps.Service.reverseGeocode({
                      coords: new window.naver.maps.LatLng(centerLat, centerLng),
                      orders: [window.naver.maps.Service.OrderType.LEGAL_CODE].join(',')
                    }, function(status: any, response: any) {
                      if (status === 200 && response.v2.results.length > 0) {
                        const bcode = response.v2.results[0].code.id;
                        if (bcode && bcode.length === 10) {
                          const sido = bcode.substring(0, 2) + '00000000';
                          const sigungu = bcode.substring(0, 5) + '00000';
                          const dong = bcode;
                          if (level === 'sido') {
                            setSelectedSido(sido);
                            setSelectedSigungu('');
                            setSelectedDong('');
                          } else if (level === 'sigungu') {
                            setSelectedSido(sido);
                            setTimeout(() => setSelectedSigungu(sigungu), 100);
                            setSelectedDong('');
                          } else {
                            setSelectedSido(sido);
                            setTimeout(() => setSelectedSigungu(sigungu), 100);
                            setTimeout(() => setSelectedDong(dong), 200);
                          }
                        }
                      }
                    });
                  });
                  
                  labelCache[level].push(marker);
                }
              }
            });
          }
          // 만약 로딩 중에 줌이 바뀌었으면 그리지 않음
          const currentLevel = mapZoom <= 10 ? 'sido' : (mapZoom <= 13 ? 'sigungu' : 'dong');
          if (level === currentLevel && showRegions) {
            drawLevel(level);
          }
        });
    }
  }, [mapZoom, showRegions]);

  useEffect(() => {
    if (!window.naver || !window.naver.maps || !window.naver.maps.Service) return;
    
    // 선택된 행정구역 이름 조합
    let query = '';
    const sidoName = sidos.find(s => s.code === selectedSido)?.name || '';
    const sigunguName = sigungus.find(s => s.code === selectedSigungu)?.name || '';
    const dongName = dongs.find(s => s.code === selectedDong)?.name || '';
    
    if (dongName) query = `${sidoName} ${sigunguName} ${dongName}`.trim();
    else if (sigunguName) query = `${sidoName} ${sigunguName}`.trim();
    else if (sidoName) query = sidoName;
    
    if (!query) return;

    // 네이버 지오코딩으로 해당 구역 중심 좌표 찾기
    // @ts-ignore
    window.naver.maps.Service.geocode({ query }, function(status, response) {
      // @ts-ignore
      if (status === window.naver.maps.Service.Status.OK && response.v2.addresses.length > 0) {
        const item = response.v2.addresses[0];
        setMapCenter({ lat: parseFloat(item.y), lng: parseFloat(item.x) });
        // 하위 구역이 보이도록 줌 레벨 조정
        if (dongName) setMapZoom(15);
        else if (sigunguName) setMapZoom(14); // 14부터 동이 보임
        else setMapZoom(11); // 11부터 시군구가 보임
      }
    });
  }, [selectedSido, selectedSigungu, selectedDong, sidos, sigungus, dongs]);



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
    
    // DB에 dong, sigungu 컬럼이 존재하지 않으므로 오직 address.ilike 로만 필터링합니다.
    if (selectedDong) {
      const dongName = dongs.find(d => d.code === selectedDong)?.name.split(' ').pop();
      if (dongName) query = query.ilike('address', `%${dongName}%`);
    } 
    else if (selectedSigungu) {
      const sigName = sigungus.find(s => s.code === selectedSigungu)?.name.split(' ').pop();
      if (sigName) query = query.ilike('address', `%${sigName}%`);
    } 
    else if (selectedSido) {
      const sidoName = sidos.find(s => s.code === selectedSido)?.name;
      if (sidoName) query = query.ilike('address', `%${sidoName.substring(0, 2)}%`);
    }

    query.then(({ data, error }) => {
      if (!error && data) {
        // 중복 좌표 분산 처리 (같은 집에 여러 어르신이 있을 경우 마커가 겹치는 현상 방지)
        const offsetData = data.map((marker, index) => {
          const overlappingCount = data.filter((m, i) => i < index && m.lat === marker.lat && m.lng === marker.lng).length;
          if (overlappingCount > 0) {
            const angle = overlappingCount * (Math.PI / 3); // 60 degrees apart
            const distance = 0.00015; // 대략 15m 오프셋
            return {
              ...marker,
              lat: marker.lat + (Math.sin(angle) * distance),
              lng: marker.lng + (Math.cos(angle) * distance)
            };
          }
          return marker;
        });
        setMarkers(offsetData);
      }
    });
  };

  useEffect(() => {
    fetchMarkers();
  }, [selectedSido, selectedSigungu, selectedDong]);

  // 앱 실행 시 즉시 현재 위치로 이동 (초기 1회)
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // 사용자가 이미 다른 곳을 클릭해서 이동 중이라면 방해하지 않음
          if (selectedSido || selectedSigungu || selectedDong) return;
          
          setMapCenter({ lat: position.coords.latitude, lng: position.coords.longitude });
          setMapZoom(15); // 주변 동네가 보이도록 줌인

          // 내 위치의 행정구역으로 드롭다운 자동 세팅 (Reverse Geocoding)
          if (window.naver && window.naver.maps && window.naver.maps.Service) {
            // @ts-ignore
            window.naver.maps.Service.reverseGeocode({
              coords: new window.naver.maps.LatLng(position.coords.latitude, position.coords.longitude),
              orders: [window.naver.maps.Service.OrderType.LEGAL_CODE].join(',')
            }, function(status: any, response: any) {
              if (status === 200 && response.v2.results.length > 0) {
                const bcode = response.v2.results[0].code.id;
                if (bcode && bcode.length === 10) {
                  const sido = bcode.substring(0, 2) + '00000000';
                  const sigungu = bcode.substring(0, 5) + '00000';
                  const dong = bcode;
                  setSelectedSido(sido);
                  setTimeout(() => setSelectedSigungu(sigungu), 200);
                  setTimeout(() => setSelectedDong(dong), 400);
                }
              }
            });
          }
        },
        (error) => {
          console.warn('초기 위치 정보를 가져올 수 없습니다.', error);
        },
        { enableHighAccuracy: false, maximumAge: 60000, timeout: 5000 }
      );
    }
  }, []);

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
      window.location.reload();
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
                onChange={(e) => {
                  setSelectedSido(e.target.value);
                  setSelectedSigungu('');
                  setSelectedDong('');
                }}
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
                onChange={(e) => {
                  setSelectedSigungu(e.target.value);
                  setSelectedDong('');
                }}
                sx={{ borderRadius: 1, fontWeight: 700, fontSize: '14px', '& fieldset': { border: 'none' }, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
              >
                <option value="">군/구</option>
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
                defaultZoom={mapZoom}
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
            
            {/* 검색바 */}
            <div className="mb-5 relative">
              <input 
                type="text"
                placeholder="어르신 이름 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-2xl py-3.5 pl-12 pr-10 text-[16px] shadow-sm font-semibold text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
              />
              <IconSearch size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 bg-slate-100 p-1 rounded-full"
                >
                  <IconX size={16} />
                </button>
              )}
            </div>

            {(markers.length === 0) ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 mt-16">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                  <IconUser size={32} className="text-slate-300" />
                </div>
                <p className="font-bold text-lg text-slate-500">이 지역엔 등록된 어르신이 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {(() => {
                  const filteredMarkers = markers
                    .filter(marker => marker.name.includes(searchQuery))
                    .sort((a,b) => a.visit_time.localeCompare(b.visit_time));
                  
                  if (filteredMarkers.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center text-slate-400 mt-12 bg-white rounded-3xl py-12 shadow-sm border border-slate-100">
                        <IconSearch size={40} className="text-slate-200 mb-4" />
                        <p className="font-bold text-lg text-slate-500">'{searchQuery}' 검색 결과가 없습니다.</p>
                      </div>
                    );
                  }

                  return filteredMarkers.map((marker) => (
                  <Card 
                    key={marker.id} 
                    elevation={0} 
                    sx={{ 
                      borderRadius: 4, 
                      mb: 2, 
                      border: '1px solid #f1f5f9', 
                      boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
                      transition: 'all 0.2s',
                      cursor: 'pointer',
                      '&:active': { transform: 'scale(0.98)' }
                    }}
                    onClick={() => {
                      setMapCenter({ lat: marker.lat, lng: marker.lng });
                      setMapZoom(17); // Zoom in deeply
                      setActiveTab('map'); // Switch to map tab
                      setSelectedRecipient(null);
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
                        <Box sx={{ display: 'flex', gap: 1 }} onClick={(e) => e.stopPropagation()}>
                          <IconButton onClick={(e) => { e.stopPropagation(); setEditingRecipient(marker); setIsModalOpen(true); }} size="small" sx={{ bgcolor: '#f8fafc', color: '#64748b', '&:hover': { bgcolor: '#e2e8f0' } }}>
                            <IconPencil size={18} />
                          </IconButton>
                          <IconButton onClick={(e) => { e.stopPropagation(); handleDelete(marker.id); }} size="small" sx={{ bgcolor: '#fef2f2', color: '#ef4444', '&:hover': { bgcolor: '#fecaca' } }}>
                            <IconTrash size={18} />
                          </IconButton>
                        </Box>
                      </Box>
                      
                      <Paper elevation={0} sx={{ bgcolor: '#f8fafc', p: 2, borderRadius: 3, mb: 2.5, display: 'flex', gap: 1.5, alignItems: 'center' }}>
                        <IconMapPin size={22} color="#94a3b8" style={{ flexShrink: 0 }} />
                        <Typography variant="body1" sx={{ fontWeight: 600, color: '#475569', lineHeight: 1.4 }}>
                          {marker.address}
                        </Typography>
                      </Paper>

                      <Button
                        variant="contained"
                        fullWidth
                        size="large"
                        startIcon={<IconNavigation />}
                        onClick={(e) => { e.stopPropagation(); handleDirections(marker.lat, marker.lng, marker.address); }}
                        sx={{ py: 1.5, borderRadius: 3, fontSize: '1.05rem', fontWeight: 800, bgcolor: '#0f172a', '&:hover': { bgcolor: '#1e293b' }, boxShadow: '0 4px 14px rgba(15,23,42,0.2)' }}
                      >
                        길안내 시작
                      </Button>
                    </CardContent>
                  </Card>
                ))})()}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Action Button (Add Recipient) */}
      {activeTab === 'map' && (
        <>
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
        </>
      )}

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
          window.location.reload(); // 강제 새로고침
        }}
        recipientToEdit={editingRecipient}
      />
    </main>
  );
}

import dynamic from 'next/dynamic';
export default dynamic(() => Promise.resolve(MainApp), { ssr: false });
