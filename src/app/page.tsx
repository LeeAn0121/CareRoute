'use client';
import { useState, useEffect, useRef } from 'react';
import { Container, NaverMap, Marker } from 'react-naver-maps';
import { IconMapPin, IconList, IconPlus, IconNavigation, IconClock, IconUser, IconDownload, IconShare, IconX, IconSearch, IconChevronRight, IconCheck, IconPencil, IconTrash } from '@tabler/icons-react';
import { supabase } from '@/lib/supabase';
import { Select, MenuItem, FormControl, Button, Fab, BottomNavigation, BottomNavigationAction, Paper, Typography, Card, CardContent, Drawer, Box, Chip, IconButton, CircularProgress } from '@mui/material';
import RecipientModal from '@/components/RecipientModal';

interface RegCode {
  code: string;
  name: string;
}

interface Recipient {
  id: string;
  name: string;
  address: string;
  detail_address?: string | null;
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

// VAPID 공개키(base64url)를 PushManager.subscribe가 요구하는 Uint8Array로 변환
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
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
    setIsLocating(true);

    const onSuccess = (position: GeolocationPosition) => {
      setIsLocating(false);
      setMapCenter({ lat: position.coords.latitude, lng: position.coords.longitude });
      setMapZoom(17);
    };

    // 정확도 우선으로 먼저 시도하고, 실패/타임아웃되면 더 관대한 조건으로
    // 한 번 더 재시도한다. (실내/건물 사이 등 GPS 신호가 약할 때 5초
    // 타임아웃 한 번에 바로 포기해서 '안 될 때가 많다'는 문제가 있었음)
    navigator.geolocation.getCurrentPosition(
      onSuccess,
      () => {
        navigator.geolocation.getCurrentPosition(
          onSuccess,
          () => {
            setIsLocating(false);
            alert("위치 정보를 가져올 수 없습니다. GPS/위치 권한이 켜져 있는지 확인해주세요.");
          },
          { enableHighAccuracy: false, maximumAge: 60000, timeout: 10000 },
        );
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 },
    );
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
  const [isLocating, setIsLocating] = useState(false);
  const [showRegions, setShowRegions] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const mapRef = useRef<any>(null);
  const isAutoSelectRef = useRef(false);
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

    // 지도 이동/확대 시 상태 동기화 및 마커/폴리곤 업데이트
    window.naver.maps.Event.clearListeners(map, 'idle');
    window.naver.maps.Event.addListener(map, 'idle', () => {
        // 항상 지도 상태를 동기화하여 수동 줌인/줌아웃 시에도 mapZoom 상태가 최신으로 유지되게 함
        const currentZoom = map.getZoom();
        setMapZoom(currentZoom);
        
        const currentCenter = map.getCenter();
        setMapCenter({ lat: currentCenter.y, lng: currentCenter.x });

        if (!showRegions || !currentRenderedLevel) return;
        const bounds = map.getBounds();
        
        // 줌 레벨 변동 없이 패닝만 일어났을 때도 폴리곤 채우기
        const minLat = bounds.minY() - 0.15;
        const maxLat = bounds.maxY() + 0.15;
        const minLng = bounds.minX() - 0.15;
        const maxLng = bounds.maxX() + 0.15;
        


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

    // 만약 마커 클릭이나 GPS 자동 세팅으로 인한 드롭다운 변경이라면, 지도를 강제로 패닝/줌아웃 하지 않음
    if (isAutoSelectRef.current) {
      isAutoSelectRef.current = false; // Reset after one skip
      return;
    }

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
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const waitingWorkerRef = useRef<ServiceWorker | null>(null);
  
  // Push 알림 구독: 서버(Edge Function)가 방문 예정 시간에 맞춰 실제 Web Push를
  // 보내주므로, 앱이 닫혀있거나 백그라운드여도 알림이 온다. (예전의 setInterval
  // 기반 포그라운드 전용 체크는 앱이 열려있을 때만 동작해 신뢰할 수 없었음)
  useEffect(() => {
    const setupPush = async () => {
      if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return;

      if (Notification.permission === 'default') {
        const result = await Notification.requestPermission();
        if (result !== 'granted') return;
      }
      if (Notification.permission !== 'granted') return;

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) return;

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
      }

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;

      await supabase.from('push_subscriptions').upsert(
        { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth },
        { onConflict: 'endpoint' },
      );
    };

    setupPush().catch((err) => console.warn('Push 구독 설정 실패:', err));
  }, []);

  useEffect(() => {
    // Check iOS and Standalone
    const ios = /iPad|iPhone|iPod/i.test(navigator.userAgent);
    setIsIOS(ios);
    
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    // Register Service Worker and handle updates
    if ('serviceWorker' in navigator) {
      const notifyUpdateAvailable = (worker: ServiceWorker) => {
        waitingWorkerRef.current = worker;
        setUpdateAvailable(true);
        // 앱이 백그라운드/다른 화면에 있어도 알아챌 수 있도록 시스템 알림도 함께 띄움
        if (Notification.permission === 'granted') {
          navigator.serviceWorker.ready.then((reg) => {
            reg.showNotification('케어루트 업데이트', {
              body: '새 버전이 있습니다. 눌러서 새로고침하세요.',
              icon: '/CareRoute/icon-192.png',
              tag: 'careroute-update',
              data: { type: 'update' },
            });
          });
        }
      };

      navigator.serviceWorker.register('/CareRoute/sw.js').then((registration) => {
        // 등록 시점에 이미 새 버전이 대기 중인 경우 (예: 이전 방문 때 못 보고 넘어간 업데이트)
        if (registration.waiting && navigator.serviceWorker.controller) {
          notifyUpdateAvailable(registration.waiting);
        }

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            // controller가 이미 있다 = 첫 설치가 아니라 갱신된 버전이 새로 설치된 것
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              notifyUpdateAvailable(newWorker);
            }
          });
        });

        // 앱을 오래 켜두는 현장 특성상, 새로고침 없이도 주기적으로 새 버전을 확인
        const updateCheckId = setInterval(() => registration.update().catch(() => {}), 5 * 60 * 1000);
        return () => clearInterval(updateCheckId);
      }).catch(console.error);

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
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

  const handleUpdateRefresh = async () => {
    // 강제 캐시 지우기: 새 버전 파일들을 확실히 새로 받아오도록 기존 캐시를 모두 비움
    if ('caches' in window) {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      } catch {}
    }
    waitingWorkerRef.current?.postMessage('SKIP_WAITING');
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
        // 근접 마커 자동 분산 처리: 완전히 같은 좌표뿐 아니라 같은 건물/블록처럼
        // '근처'인 경우까지 하나의 클러스터로 묶어 부챗살 모양으로 벌려서 배치한다.
        const PROXIMITY_KM = 0.02; // 약 20m 이내는 같은 클러스터로 취급
        const clusters: typeof data[] = [];

        data.forEach((marker) => {
          const cluster = clusters.find((c) =>
            getDistanceFromLatLonInKm(c[0].lat, c[0].lng, marker.lat, marker.lng) < PROXIMITY_KM
          );
          if (cluster) cluster.push(marker);
          else clusters.push([marker]);
        });

        const offsetData: typeof data = [];
        clusters.forEach((cluster) => {
          if (cluster.length === 1) {
            offsetData.push(cluster[0]);
            return;
          }
          // 인원이 많은 클러스터일수록 반경을 넓혀서 계속 겹치지 않게 함
          const radius = 0.00015 + (cluster.length - 2) * 0.00003;
          cluster.forEach((marker, i) => {
            const angle = (2 * Math.PI * i) / cluster.length;
            offsetData.push({
              ...marker,
              lat: cluster[0].lat + Math.sin(angle) * radius,
              lng: cluster[0].lng + Math.cos(angle) * radius,
            });
          });
        });

        setMarkers(offsetData);
      }
    });
  };

  useEffect(() => {
    fetchMarkers();
  }, [selectedSido, selectedSigungu, selectedDong]);

  // 방문 알림을 눌렀을 때 해당 어르신 위치로 포커싱 (명단 클릭과 동일한 효과).
  // 현재 지역 필터에 안 걸릴 수도 있으니 필터를 해제하고 DB에서 직접 가져온다.
  const focusRecipientById = async (id: string) => {
    const { data, error } = await supabase.from('recipients').select('*').eq('id', id).single();
    if (error || !data) return;
    setSelectedSido('');
    setSelectedSigungu('');
    setSelectedDong('');
    setMapCenter({ lat: data.lat, lng: data.lng });
    setMapZoom(17);
    setActiveTab('map');
    setSelectedRecipient(data);
  };

  useEffect(() => {
    const focusId = new URLSearchParams(window.location.search).get('focus');
    if (focusId) {
      focusRecipientById(focusId);
      window.history.replaceState({}, '', window.location.pathname);
    }

    if (!('serviceWorker' in navigator)) return;
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'FOCUS_RECIPIENT' && event.data.id) {
        focusRecipientById(event.data.id);
      }
    };
    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, []);

  const gpsInitRef = useRef(false);
  // 앱 실행 시 즉시 현재 위치로 이동 (초기 1회)
  useEffect(() => {
    if (mapLoaded && navigator.geolocation && !gpsInitRef.current) {
      gpsInitRef.current = true;
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
                  isAutoSelectRef.current = true;
                  setSelectedSido(sido);
                  setTimeout(() => { isAutoSelectRef.current = true; setSelectedSigungu(sigungu); }, 200);
                  setTimeout(() => { isAutoSelectRef.current = true; setSelectedDong(dong); }, 400);
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
  }, [mapLoaded]);

  useEffect(() => {
    fetch('https://grpc-proxy-server-mkvo6j4wsq-du.a.run.app/v1/regcodes?regcode_pattern=*00000000')
      .then(res => res.json())
      .then(data => {
        setSidos(data.regcodes || []);
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

      {/* 앱 업데이트 안내창 */}
      {updateAvailable && (
        <div className="absolute top-4 left-4 right-4 z-[60] bg-slate-800 text-white p-4 rounded-2xl shadow-xl flex items-center justify-between animate-fade-in-down">
          <div className="flex items-center gap-3">
            <div className="bg-white/15 p-2 rounded-xl">
              <IconDownload size={20} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-sm">새 버전이 있습니다</p>
              <p className="text-xs text-slate-300">지금 새로고침하면 최신 버전으로 업데이트돼요</p>
            </div>
          </div>
          <button
            onClick={handleUpdateRefresh}
            className="px-4 py-2 bg-white text-slate-800 font-bold rounded-xl text-sm shadow-sm active:scale-95 transition-transform whitespace-nowrap"
          >
            새로고침
          </button>
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
                      content: (() => {
                        const isSelected = selectedRecipient?.id === marker.id;
                        return `
                        <div class="relative flex items-center justify-center ${isSelected ? 'scale-125 z-50' : 'scale-100'} transition-transform duration-300">
                          ${isSelected ? '<div class="absolute -inset-2 bg-amber-400 rounded-full opacity-60 animate-ping"></div>' : ''}
                          <div class="relative ${isSelected ? 'bg-amber-500' : 'bg-teal-600'} text-white rounded-full p-2.5 shadow-[0_4px_16px_rgba(0,0,0,0.35)] border-2 border-white transition-colors duration-300">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                          </div>
                        </div>
                      `;
                      })(),
                      anchor: { x: 24, y: 24 }
                    }}
                  />
                ))}
              </NaverMap>
            </Container>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-400 px-8 text-center pt-20">
              <div className="relative w-24 h-24 flex items-center justify-center mb-6">
                <div className="absolute inset-0 rounded-full border-4 border-teal-100"></div>
                <div className="absolute inset-0 rounded-full border-4 border-teal-500 border-t-transparent animate-spin"></div>
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm">
                  <IconMapPin size={28} className="text-teal-500" />
                </div>
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
                      // 어떤 어르신 위치로 포커싱된 건지 확실히 보이도록 해당
                      // 마커를 선택 상태로 만든다 (마커가 앰버색으로 바뀌며
                      // 핑 애니메이션 + 하단 상세 시트가 함께 뜸).
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
                          {marker.address}{marker.detail_address ? ` ${marker.detail_address}` : ''}
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
      {/* 우측 플로팅 버튼 스택: 헤더 높이(+노치 안전영역)만큼 아래에서 시작해서
          헤더의 시/도·군/구·동 select와 겹치지 않게 한 줄로 쌓는다. */}
      <div
        className="absolute right-4 z-40 flex flex-col gap-2"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 132px)' }}
      >
        {/* 캐시 강제 삭제 및 새로고침 버튼 (모바일용) */}
        <Fab
          size="small"
          onClick={async () => {
            if ('caches' in window) {
              const keys = await caches.keys();
              await Promise.all(keys.map(key => caches.delete(key)));
            }
            if ('serviceWorker' in navigator) {
              const regs = await navigator.serviceWorker.getRegistrations();
              for (let reg of regs) {
                await reg.unregister();
              }
            }
            window.location.href = window.location.pathname + '?t=' + Date.now();
          }}
          sx={{ bgcolor: '#ef4444', color: '#ffffff', borderRadius: 2, '&:hover': { bgcolor: '#dc2626' } }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path></svg>
        </Fab>

        {activeTab === 'map' && (
          <>
            {/* 행정구역 토글 버튼 */}
            <Fab
              size="small"
              onClick={() => setShowRegions(!showRegions)}
              sx={{ bgcolor: showRegions ? '#0d9488' : '#ffffff', color: showRegions ? '#ffffff' : '#475569', borderRadius: 2 }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
            </Fab>

            {/* 확대/축소 버튼 */}
            <Fab size="small" onClick={() => setMapZoom(prev => Math.min(prev + 1, 21))} sx={{ bgcolor: '#ffffff', borderRadius: 2, mt: 1 }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </Fab>
            <Fab size="small" onClick={() => setMapZoom(prev => Math.max(prev - 1, 6))} sx={{ bgcolor: '#ffffff', borderRadius: 2 }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </Fab>

            {/* 내 위치 버튼 */}
            <Fab size="small" onClick={handleMyLocation} disabled={isLocating} sx={{ bgcolor: '#ffffff', borderRadius: 2, mt: 1 }}>
              {isLocating ? (
                <CircularProgress size={18} sx={{ color: '#0d9488' }} />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19 12h2"></path><path d="M3 12h2"></path><path d="M12 3v2"></path><path d="M12 19v2"></path><circle cx="12" cy="12" r="8"></circle></svg>
              )}
            </Fab>
          </>
        )}
      </div>

      <Fab 
        color="primary" 
        aria-label="어르신 추가" 
        onClick={() => { setEditingRecipient(null); setIsModalOpen(true); }}
        sx={{ position: 'absolute', bottom: 100, right: 24, zIndex: 40, width: 56, height: 56, borderRadius: 3, boxShadow: '0 4px 12px rgba(13,148,136,0.3)' }}
      >
        <IconPlus size={32} strokeWidth={2.5} />
      </Fab>

      {/* Map Marker Popup (비중을 줄인 컴팩트 버전) */}
      <Drawer
        anchor="bottom"
        open={Boolean(selectedRecipient && activeTab === 'map')}
        onClose={() => setSelectedRecipient(null)}
        sx={{ '& .MuiDrawer-paper': { borderTopLeftRadius: 16, borderTopRightRadius: 16, p: 2, pb: 11 } }}
        ModalProps={{ keepMounted: true }}
      >
        {selectedRecipient && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                <Typography variant="subtitle1" component="div" sx={{ fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap' }}>
                  {selectedRecipient.name} 어르신
                </Typography>
                <Chip
                  icon={<IconClock size={12} />}
                  label={`${selectedRecipient.notes ? selectedRecipient.notes.substring(5) + ' ' : ''}${selectedRecipient.visit_time.substring(0, 5) === '00:00' ? '시간 미정' : selectedRecipient.visit_time.substring(0, 5)}`}
                  size="small"
                  sx={{ height: 22, fontSize: 11, fontWeight: 700, bgcolor: '#f1f5f9', color: '#475569', '& .MuiChip-icon': { color: '#475569', ml: 0.5 } }}
                />
              </Box>
              <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                <IconButton onClick={() => { setIsModalOpen(true); setEditingRecipient(selectedRecipient); }} size="small">
                  <IconPencil size={16} />
                </IconButton>
                <IconButton onClick={() => handleDelete(selectedRecipient.id)} size="small" sx={{ color: '#ef4444' }}>
                  <IconTrash size={16} />
                </IconButton>
                <IconButton onClick={() => setSelectedRecipient(null)} size="small">
                  <IconX size={16} />
                </IconButton>
              </Box>
            </Box>
            <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 500, mb: 1.5, display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
              <IconMapPin size={14} style={{ flexShrink: 0, marginTop: 2 }} />
              {selectedRecipient.address}{selectedRecipient.detail_address ? ` ${selectedRecipient.detail_address}` : ''}
            </Typography>
            <Button
              variant="contained"
              fullWidth
              startIcon={<IconNavigation size={18} />}
              onClick={() => handleDirections(selectedRecipient.lat, selectedRecipient.lng, selectedRecipient.address)}
              sx={{ py: 1, borderRadius: 2, fontSize: '0.95rem', fontWeight: 700, bgcolor: '#0f172a', boxShadow: 'none', '&:hover': { bgcolor: '#1e293b' } }}
            >
              길안내 시작
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
