'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { Container, NaverMap, Marker } from 'react-naver-maps';
import { IconMapPin, IconList, IconPlus, IconNavigation, IconClock, IconUser, IconDownload, IconShare, IconX, IconSearch, IconChevronRight, IconCheck, IconPencil, IconTrash } from '@tabler/icons-react';
import { supabase } from '@/lib/supabase';
import RecipientModal from '@/components/RecipientModal';
import { Button, IconButton, NativeSelect, Chip, BottomSheet, Spinner } from '@/components/ui';

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
  last_completed_key?: string | null;
  recurring_weekdays?: string | null;
  photo_url?: string | null;
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


// GeoJSON 및 마커 캐시
const geoCache: any = { sido: null, sigungu: null, dong: null };
// 라벨 마커는 화면에 보이는 것만 그때그때(lazy) 만들어서 재사용한다.
// (동/읍/면은 전국 약 3,500개라 미리 다 만들면 메인 스레드가 멈춘다)
const labelCache: any = { sido: new Map(), sigungu: new Map(), dong: new Map() };
// 현재 map.data에 실제로 추가되어 있는 폴리곤의 feature 이름 집합.
// idle(패닝)마다 map.data.getAllFeature()로 전수조사하지 않기 위해 직접 추적.
const renderedFeatureKeys: any = { sido: new Set(), sigungu: new Set(), dong: new Set() };
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
  
  const [activeTab, setActiveTab] = useState<'map' | 'list' | 'route'>('map');
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapZoom, setMapZoom] = useState(15);
  const [isLocating, setIsLocating] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
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

    const styleFor = (lvl: string) => ({
      fillColor: lvl === 'dong' ? '#0ea5e9' : (lvl === 'sigungu' ? '#0d9488' : '#8b5cf6'),
      fillOpacity: 0.1,
      strokeColor: lvl === 'dong' ? '#0ea5e9' : (lvl === 'sigungu' ? '#0d9488' : '#8b5cf6'),
      strokeWeight: lvl === 'dong' ? 1 : 2,
      strokeOpacity: 0.6,
      visible: true
    });

    // 폴리곤/라벨 클릭 시 공통으로 쓰는 로직 (중복 제거)
    const handleRegionSelect = (lat: number, lng: number, lvl: string) => {
      if (!window.naver.maps.Service) return;
      // @ts-ignore
      window.naver.maps.Service.reverseGeocode({
        coords: new window.naver.maps.LatLng(lat, lng),
        orders: [window.naver.maps.Service.OrderType.LEGAL_CODE].join(',')
      }, function (status: any, response: any) {
        if (status === 200 && response.v2.results.length > 0) {
          const bcode = response.v2.results[0].code.id; // 10자리 법정동 코드
          if (bcode && bcode.length === 10) {
            const sido = bcode.substring(0, 2) + '00000000';
            const sigungu = bcode.substring(0, 5) + '00000';
            const dong = bcode;
            if (lvl === 'sido') {
              setSelectedSido(sido);
              setSelectedSigungu('');
              setSelectedDong('');
            } else if (lvl === 'sigungu') {
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
    };

    // 라벨 마커는 필요한 것만 그때그때 만들어서 재사용 (전국 데이터를 한 번에
    // 다 만들면 동/읍/면 기준 약 3,500개 생성으로 메인 스레드가 멈춘다)
    const ensureLabelMarker = (lvl: string, feature: any) => {
      const name = feature.properties.name;
      const cached = labelCache[lvl].get(name);
      if (cached) return cached;

      const centerLat = feature.properties._centerLat;
      const centerLng = feature.properties._centerLng;
      const bg = lvl === 'dong' ? 'rgba(14, 165, 233, 0.85)' : (lvl === 'sigungu' ? 'rgba(13, 148, 136, 0.95)' : 'rgba(139, 92, 246, 0.95)');
      const fs = lvl === 'dong' ? '11px' : '13px';

      const marker = new window.naver.maps.Marker({
        position: new window.naver.maps.LatLng(centerLat, centerLng),
        icon: {
          content: `<div style="padding: 2px 6px; background: ${bg}; color: white; border-radius: 8px; font-size: ${fs}; font-weight: bold; border: 1px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2); white-space: nowrap; cursor: pointer;">${name}</div>`,
          anchor: new window.naver.maps.Point(20, 10)
        }
      });
      window.naver.maps.Event.addListener(marker, 'click', () => handleRegionSelect(centerLat, centerLng, lvl));
      labelCache[lvl].set(name, marker);
      return marker;
    };

    const featuresInView = (lvl: string, bounds: any) => {
      const minLat = bounds.minY() - 0.15;
      const maxLat = bounds.maxY() + 0.15;
      const minLng = bounds.minX() - 0.15;
      const maxLng = bounds.maxX() + 0.15;
      return geoCache[lvl].features.filter((f: any) => {
        const lat = f.properties?._centerLat;
        const lng = f.properties?._centerLng;
        if (lat == null || lng == null) return false;
        return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
      });
    };

    const drawLevel = (lvl: string) => {
      currentRenderedLevel = lvl;
      // 1. 기존 폴리곤/라벨 모두 지우기
      map.data.getAllFeature().forEach((f: any) => map.data.removeFeature(f));
      renderedFeatureKeys.sido.clear();
      renderedFeatureKeys.sigungu.clear();
      renderedFeatureKeys.dong.clear();
      ['sido', 'sigungu', 'dong'].forEach(l => {
        labelCache[l].forEach((m: any) => m.setMap(null));
      });

      // 2. 뷰포트 근처 것만 그리기 (모든 레벨에 동일하게 적용)
      const bounds = map.getBounds();
      const visible = featuresInView(lvl, bounds);

      map.data.addGeoJson({ type: 'FeatureCollection', features: visible });
      map.data.setStyle(styleFor(lvl));
      visible.forEach((f: any) => {
        renderedFeatureKeys[lvl].add(f.properties.name);
        ensureLabelMarker(lvl, f).setMap(map);
      });
    };

    // 폴리곤 클릭 시 해당 구역으로 드롭다운 자동 필터링 (Reverse Geocoding)
    if (!window.naver.maps.Event.hasListener(map.data, 'click')) {
      window.naver.maps.Event.addListener(map.data, 'click', (e: any) => {
        const lat = e.feature.properties?._centerLat;
        const lng = e.feature.properties?._centerLng;
        if (!lat || !lng) return;
        handleRegionSelect(lat, lng, currentRenderedLevel);
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

        if (!showRegions || !currentRenderedLevel || !geoCache[currentRenderedLevel]) return;
        const lvl = currentRenderedLevel;
        const bounds = map.getBounds();

        // 새로 보여야 할 폴리곤/라벨만 추가 (map.data 전수조사 없이 직접
        // 추적한 renderedFeatureKeys로 이미 그려진 것만 걸러낸다)
        const visible = featuresInView(lvl, bounds);
        const toAdd = visible.filter((f: any) => !renderedFeatureKeys[lvl].has(f.properties.name));

        if (toAdd.length > 0) {
          map.data.addGeoJson({ type: 'FeatureCollection', features: toAdd });
          map.data.setStyle(styleFor(lvl));
          toAdd.forEach((f: any) => {
            renderedFeatureKeys[lvl].add(f.properties.name);
            ensureLabelMarker(lvl, f).setMap(map);
          });
        }

        // 화면 밖으로 나간 라벨은 숨겨서(제거는 아님) 다시 들어오면 재사용
        labelCache[lvl].forEach((m: any) => {
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
          // 마커는 만들지 않고 각 feature의 중심 좌표만 가볍게 미리 계산해둔다
          // (실제 라벨 마커 생성은 drawLevel/idle 단계에서 화면에 보이는 것만 lazy하게)
          if (geojson.features) {
            geojson.features.forEach((feature: any) => {
              const coords = feature.geometry?.coordinates;
              if (!feature.properties?.name || !coords) return;
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
                feature.properties._centerLat = (minLat + maxLat) / 2;
                feature.properties._centerLng = (minLng + maxLng) / 2;
              }
            });
          }
          geoCache[level] = geojson;

          // 로딩 중에 줌이 바뀌었으면 그리지 않음
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
  const INSTALL_DISMISSED_KEY = 'careroute_install_dismissed';
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true); // default true to hide initially
  // X로 한 번 닫으면 새로고침해도 계속 안 뜨게 유지 (단, 강제 새로고침
  // 버튼을 눌렀을 때는 이 값을 지워서 다시 뜨도록 함)
  const [installDismissed, setInstallDismissed] = useState(false);
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

    try {
      if (localStorage.getItem(INSTALL_DISMISSED_KEY) === 'true') {
        setInstallDismissed(true);
      }
    } catch {}


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

  const OFFLINE_CACHE_KEY = 'careroute_markers_cache_v1';

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
        setIsOffline(false);
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

        // 필터 없이 받은 전체 목록만 오프라인 캐시로 저장 (현장에서 신호가
        // 약해져도 마지막으로 받은 명단/위치는 계속 보이도록).
        if (!selectedSido && !selectedSigungu && !selectedDong) {
          try {
            localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data: offsetData }));
          } catch {}
        }
      } else {
        // 네트워크 실패 등으로 못 받아왔으면 마지막으로 저장해둔 캐시를 대신 보여준다.
        try {
          const cached = localStorage.getItem(OFFLINE_CACHE_KEY);
          if (cached) {
            const { data: cachedData } = JSON.parse(cached);
            setMarkers(cachedData);
          }
        } catch {}
        setIsOffline(true);
      }
    });
  };

  useEffect(() => {
    fetchMarkers();
  }, [selectedSido, selectedSigungu, selectedDong]);

  // 네트워크가 끊겼다가 다시 연결되면 캐시 대신 최신 데이터로 자동 갱신
  useEffect(() => {
    const handleOnline = () => fetchMarkers();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
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

  // 줌 레벨에 따라 마커를 행정구역(시/도 → 시/군/구 → 동/읍/면) 단위로 묶어
  // 숫자 뱃지로 보여준다. 거리 기반 그리드 대신 실제 행정구역 코드로 묶기
  // 때문에, 지도를 조금만 움직여도 클러스터가 들쭉날쭉 바뀌던 문제가 없고
  // 행정구역 경계 표시 기능과 동일한 줌 기준(10/13/15)을 공유해 일관적이다.
  const clusterField: 'sido' | 'sigungu' | 'dong' | null =
    mapZoom <= 10 ? 'sido' : mapZoom <= 13 ? 'sigungu' : mapZoom <= 15 ? 'dong' : null;

  // 클러스터를 탭했을 때 다음 단계(하위 행정구역/개별 마커)가 바로 보이는
  // 줌 레벨로 확대
  const clusterDrillZoom = clusterField === 'sido' ? 12 : clusterField === 'sigungu' ? 14 : 17;

  const markerClusters = useMemo(() => {
    if (!clusterField) return markers.map((m) => [m]);

    const groups = new Map<string, Recipient[]>();
    markers.forEach((marker) => {
      const key = marker[clusterField] || '__unknown__';
      const group = groups.get(key);
      if (group) group.push(marker);
      else groups.set(key, [marker]);
    });
    return Array.from(groups.values());
  }, [markers, clusterField]);

  // 완료 체크: last_completed_key가 "오늘 날짜"와 같으면 오늘 방문 완료로 간주.
  // 날짜가 바뀌면(다음 날/다음 예정일) 자동으로 다시 미완료 상태가 된다.
  const todayYMD = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const isCompletedToday = (r: Recipient) => r.last_completed_key === todayYMD();
  const toggleCompleted = async (r: Recipient) => {
    const key = isCompletedToday(r) ? null : todayYMD();
    // 낙관적 업데이트로 목록에 바로 반영
    setMarkers((prev) => prev.map((m) => (m.id === r.id ? { ...m, last_completed_key: key } : m)));
    await supabase.from('recipients').update({ last_completed_key: key }).eq('id', r.id);
  };

  // 오늘 방문 예정인지: 특정 날짜로 지정했거나, 반복 요일에 오늘 요일이 포함되면 해당
  const isScheduledToday = (r: Recipient) => {
    const now = new Date();
    const ymd = todayYMD();
    if (r.notes === ymd) return true;
    if (r.recurring_weekdays) {
      return r.recurring_weekdays.split(',').map(Number).includes(now.getDay());
    }
    return false;
  };

  // 오늘의 경로: 시간이 정해진 일정을 뼈대로 두고, 시간 미정인 곳은 이동
  // 거리가 가장 적게 늘어나는 위치에 끼워넣는 방식(최근접 삽입 휴리스틱)으로
  // 순서를 정한다. 실제 도로 거리가 아닌 직선 거리 기준의 근사치.
  const todayRoute = useMemo(() => {
    const todays = markers.filter(isScheduledToday);
    const timed = todays
      .filter((r) => r.visit_time && r.visit_time !== '00:00:00')
      .sort((a, b) => a.visit_time.localeCompare(b.visit_time));
    const flexible = todays.filter((r) => !r.visit_time || r.visit_time === '00:00:00');

    if (flexible.length === 0) return timed;

    if (timed.length === 0) {
      const route: Recipient[] = [];
      const remaining = [...flexible];
      let curLat = mapCenter.lat, curLng = mapCenter.lng;
      while (remaining.length > 0) {
        let bestIdx = 0, bestDist = Infinity;
        remaining.forEach((r, i) => {
          const d = getDistanceFromLatLonInKm(curLat, curLng, r.lat, r.lng);
          if (d < bestDist) { bestDist = d; bestIdx = i; }
        });
        const [next] = remaining.splice(bestIdx, 1);
        route.push(next);
        curLat = next.lat; curLng = next.lng;
      }
      return route;
    }

    const route = [...timed];
    const remaining = [...flexible];
    while (remaining.length > 0) {
      let bestFlexIdx = 0, bestPos = 0, bestExtra = Infinity;
      remaining.forEach((flex, fi) => {
        const points = [{ lat: mapCenter.lat, lng: mapCenter.lng }, ...route];
        for (let i = 0; i < points.length; i++) {
          const a = points[i];
          const b = points[i + 1];
          const dA = getDistanceFromLatLonInKm(a.lat, a.lng, flex.lat, flex.lng);
          const dB = b ? getDistanceFromLatLonInKm(flex.lat, flex.lng, b.lat, b.lng) : 0;
          const dOrig = b ? getDistanceFromLatLonInKm(a.lat, a.lng, b.lat, b.lng) : 0;
          const extra = dA + dB - dOrig;
          if (extra < bestExtra) {
            bestExtra = extra;
            bestFlexIdx = fi;
            bestPos = i;
          }
        }
      });
      const [chosen] = remaining.splice(bestFlexIdx, 1);
      route.splice(bestPos, 0, chosen);
    }
    return route;
  }, [markers, mapCenter]);

  // Google 캘린더 동기화: Google Identity Services(GIS)로 액세스 토큰만 받아서
  // Calendar REST API를 직접 호출한다 (무거운 gapi 클라이언트 라이브러리 불필요).
  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false);

  const loadGoogleScript = () => new Promise<void>((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const existing = document.getElementById('google-identity-script');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-identity-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google 스크립트 로딩 실패'));
    document.body.appendChild(script);
  });

  const handleSyncToCalendar = async () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return;
    if (todayRoute.length === 0) {
      alert('오늘 방문 예정인 어르신이 없어서 동기화할 일정이 없습니다.');
      return;
    }

    setIsSyncingCalendar(true);
    try {
      await loadGoogleScript();

      const accessToken: string = await new Promise((resolve, reject) => {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/calendar.events',
          callback: (resp: any) => {
            if (resp.error) reject(new Error(resp.error));
            else resolve(resp.access_token);
          },
        });
        tokenClient.requestAccessToken();
      });

      const ymd = todayYMD();
      const authHeaders = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

      // 같은 날짜로 이미 동기화한 이벤트가 있으면 지우고 새로 만들어서
      // 여러 번 눌러도 중복 생성되지 않게 한다.
      const existingRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?privateExtendedProperty=${encodeURIComponent(`careRouteDate=${ymd}`)}`,
        { headers: authHeaders },
      );
      const existing = await existingRes.json();
      for (const ev of existing.items || []) {
        await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${ev.id}`, {
          method: 'DELETE',
          headers: authHeaders,
        });
      }

      for (const marker of todayRoute) {
        const hasTime = marker.visit_time && marker.visit_time !== '00:00:00';
        const body: any = {
          summary: `${marker.name} 어르신 방문`,
          location: `${marker.address}${marker.detail_address ? ` ${marker.detail_address}` : ''}`,
          extendedProperties: { private: { careRouteDate: ymd, careRouteRecipientId: marker.id } },
        };
        if (hasTime) {
          const startDateTime = `${ymd}T${marker.visit_time}`;
          const [h, m, s] = marker.visit_time.split(':').map(Number);
          const endDate = new Date(`${ymd}T${marker.visit_time}`);
          endDate.setMinutes(endDate.getMinutes() + 30);
          const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
          body.start = { dateTime: startDateTime, timeZone: 'Asia/Seoul' };
          body.end = { dateTime: `${ymd}T${endTime}`, timeZone: 'Asia/Seoul' };
        } else {
          body.start = { date: ymd };
          body.end = { date: ymd };
        }

        await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify(body),
        });
      }

      alert(`오늘의 경로 ${todayRoute.length}건을 구글 캘린더에 동기화했습니다.`);
    } catch (err: any) {
      console.error(err);
      alert('구글 캘린더 동기화에 실패했습니다: ' + (err?.message || err));
    } finally {
      setIsSyncingCalendar(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col h-[100dvh] relative bg-[#FBFAF7] font-sans">
      
      {/* PWA Install Banner */}
      {(!isStandalone && !installDismissed && (showInstallPrompt || isIOS)) && (
        <div className="absolute top-4 left-4 right-4 z-[60] bg-[#12203D] text-white p-4 rounded-2xl shadow-xl flex items-center justify-between animate-fade-in-down">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-xl">
              <IconDownload size={20} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-sm">앱으로 설치하기</p>
              <p className="text-xs text-slate-300">바탕화면에서 바로 실행하세요</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleInstallClick}
              className="px-4 py-2 bg-[#F5A524] text-[#12203D] font-bold rounded-xl text-sm shadow-sm active:scale-95 transition-transform"
            >
              설치
            </button>
            <button
              onClick={() => {
                setShowInstallPrompt(false);
                setIsIOS(false);
                setInstallDismissed(true);
                try { localStorage.setItem(INSTALL_DISMISSED_KEY, 'true'); } catch {}
              }}
              className="p-2 text-slate-400"
            >
              <IconX size={20} />
            </button>
          </div>
        </div>
      )}

      {/* 오프라인 안내: 서버 연결에 실패하면 마지막으로 저장해둔 명단을 대신
          보여주는데, 그게 최신 데이터가 아닐 수 있다는 걸 알려준다. */}
      {isOffline && (
        <div className="absolute top-4 left-4 right-4 z-[60] bg-amber-500 text-[#12203D] p-3 rounded-2xl shadow-xl flex items-center gap-2 animate-fade-in-down">
          <IconDownload size={18} className="flex-shrink-0" />
          <p className="text-sm font-bold">오프라인 상태입니다. 마지막으로 저장된 명단을 보여주고 있어요.</p>
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
        <div className="p-4 border-b border-slate-200 bg-white">
          <h1 className="flex items-center gap-3 mb-4 text-2xl font-black text-[#12203D] tracking-tight">
            <span className="w-9 h-9 bg-[#12203D] rounded-lg flex items-center justify-center shadow-[inset_0_2px_4px_rgba(255,255,255,0.3)]">
              <IconMapPin size={20} color="white" />
            </span>
            케어루트
          </h1>

          <div className="flex gap-2">
            <NativeSelect
              value={selectedSido}
              onChange={(e) => {
                setSelectedSido(e.target.value);
                setSelectedSigungu('');
                setSelectedDong('');
              }}
            >
              <option value="">시/도</option>
              {sidos.map(sido => <option key={sido.code} value={sido.code}>{sido.name}</option>)}
            </NativeSelect>
            <NativeSelect
              value={selectedSigungu}
              disabled={!selectedSido}
              onChange={(e) => {
                setSelectedSigungu(e.target.value);
                setSelectedDong('');
              }}
            >
              <option value="">군/구</option>
              {sigungus.map(sig => <option key={sig.code} value={sig.code}>{sig.name.split(' ').pop()}</option>)}
            </NativeSelect>
            <NativeSelect
              value={selectedDong}
              disabled={!selectedSigungu}
              onChange={(e) => setSelectedDong(e.target.value)}
            >
              <option value="">동/읍/면</option>
              {dongs.map(dong => <option key={dong.code} value={dong.code}>{dong.name.split(' ').pop()}</option>)}
            </NativeSelect>
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
                ref={mapRef}
                defaultCenter={mapCenter}
                defaultZoom={mapZoom}
              >
                {markerClusters.map((cluster) => {
                  if (cluster.length === 1) {
                    const marker = cluster[0];
                    const isSelected = selectedRecipient?.id === marker.id;
                    return (
                      <Marker
                        key={marker.id}
                        position={{ lat: marker.lat, lng: marker.lng }}
                        onClick={() => setSelectedRecipient(marker)}
                        icon={{
                          content: `
                            <div class="relative flex items-center justify-center ${isSelected ? 'scale-125 z-50' : 'scale-100'} transition-transform duration-300">
                              ${isSelected ? '<div class="absolute -inset-2 bg-amber-400 rounded-full opacity-60 animate-ping"></div>' : ''}
                              <div class="relative ${isSelected ? 'bg-amber-500' : 'bg-[#12203D]'} text-white rounded-full p-2.5 shadow-[0_4px_16px_rgba(0,0,0,0.35)] border-2 border-white transition-colors duration-300">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                              </div>
                            </div>
                          `,
                          anchor: { x: 24, y: 24 }
                        }}
                      />
                    );
                  }

                  // 클러스터: 여러 명이 근처에 모여있으면 숫자 뱃지 하나로 표시.
                  // 탭하면 그 지점으로 확대되면서 개별 마커로 풀린다.
                  const centerLat = cluster.reduce((sum, m) => sum + m.lat, 0) / cluster.length;
                  const centerLng = cluster.reduce((sum, m) => sum + m.lng, 0) / cluster.length;
                  const size = cluster.length >= 10 ? 52 : cluster.length >= 5 ? 46 : 40;

                  const clusterKey = clusterField ? cluster[0][clusterField] : cluster[0].id;
                  return (
                    <Marker
                      key={`cluster-${clusterKey}`}
                      position={{ lat: centerLat, lng: centerLng }}
                      onClick={() => {
                        setMapCenter({ lat: centerLat, lng: centerLng });
                        setMapZoom(clusterDrillZoom);
                      }}
                      icon={{
                        content: `
                          <div class="flex items-center justify-center rounded-full bg-[#12203D] text-white font-extrabold border-2 border-white shadow-[0_4px_16px_rgba(0,0,0,0.35)] cursor-pointer"
                               style="width:${size}px;height:${size}px;font-size:${size >= 46 ? 16 : 14}px;">
                            ${cluster.length}
                          </div>
                        `,
                        anchor: { x: size / 2, y: size / 2 }
                      }}
                    />
                  );
                })}
              </NaverMap>
            </Container>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-400 px-8 text-center pt-20">
              <div className="relative w-24 h-24 flex items-center justify-center mb-6">
                <div className="absolute inset-0 rounded-full border-4 border-amber-100"></div>
                <div className="absolute inset-0 rounded-full border-4 border-amber-400 border-t-transparent animate-spin"></div>
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm">
                  <IconMapPin size={28} className="text-[#12203D]" />
                </div>
              </div>
              <p className="font-extrabold text-xl text-slate-600 mb-3 tracking-tight">지도 연동 대기 중</p>
              <p className="text-[15px] leading-relaxed">네이버 클라우드 서버 동기화가 지연되고 있습니다.<br/>(목록 탭은 지금 바로 정상 사용 가능합니다!)</p>
            </div>
          )}
        </div>

        {/* List View (Redesigned) */}
        {activeTab === 'list' && (
          <div className="absolute inset-0 overflow-y-auto px-4 pt-[160px] pb-32 bg-[#FBFAF7]">
            
            {/* 검색바 */}
            <div className="mb-5 relative">
              <input 
                type="text"
                placeholder="어르신 이름 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl py-3.5 pl-12 pr-10 text-[16px] shadow-sm font-semibold text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all"
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
                      <div className="flex flex-col items-center justify-center text-slate-400 mt-12 bg-white rounded-xl py-12 shadow-sm border border-slate-100">
                        <IconSearch size={40} className="text-slate-200 mb-4" />
                        <p className="font-bold text-lg text-slate-500">'{searchQuery}' 검색 결과가 없습니다.</p>
                      </div>
                    );
                  }

                  return filteredMarkers.map((marker) => (
                  <div
                    key={marker.id}
                    className="rounded-xl mb-2 border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-transform cursor-pointer active:scale-[0.98] bg-white"
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
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex gap-4 items-center">
                          <div className="w-14 h-14 bg-[#EEF1F6] rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {marker.photo_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={marker.photo_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <IconUser size={28} color="#12203D" />
                            )}
                          </div>
                          <div>
                            <p className="text-lg font-black text-[#12203D] tracking-tight">
                              {marker.name} 어르신
                            </p>
                            <Chip icon={<IconClock size={14} color="#8A5A00" />} className="mt-1 bg-[#FDECC8] text-[#8A5A00]">
                              {`${marker.notes ? marker.notes.substring(5) + ' ' : ''}${marker.visit_time.substring(0, 5) === '00:00' ? '시간 미정' : marker.visit_time.substring(0, 5) + ' 방문'}`}
                            </Chip>
                          </div>
                        </div>
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <IconButton onClick={(e) => { e.stopPropagation(); toggleCompleted(marker); }} className={isCompletedToday(marker) ? 'bg-[#4C7A6B] text-white' : 'bg-slate-50 text-slate-400 hover:bg-slate-200'} aria-label="오늘 방문 완료 체크">
                            <IconCheck size={18} />
                          </IconButton>
                          <IconButton onClick={(e) => { e.stopPropagation(); setEditingRecipient(marker); setIsModalOpen(true); }} className="bg-slate-50 text-slate-500 hover:bg-slate-200">
                            <IconPencil size={18} />
                          </IconButton>
                          <IconButton onClick={(e) => { e.stopPropagation(); handleDelete(marker.id); }} className="bg-red-50 text-red-500 hover:bg-red-200">
                            <IconTrash size={18} />
                          </IconButton>
                        </div>
                      </div>

                      <div className="bg-slate-50 rounded-lg p-4 mb-5 flex gap-3 items-center">
                        <IconMapPin size={22} color="#94a3b8" className="flex-shrink-0" />
                        <p className="font-semibold text-slate-600 leading-snug">
                          {marker.address}{marker.detail_address ? ` ${marker.detail_address}` : ''}
                        </p>
                      </div>

                      <Button
                        fullWidth
                        variant="dark"
                        startIcon={<IconNavigation size={18} />}
                        onClick={(e) => { e.stopPropagation(); handleDirections(marker.lat, marker.lng, marker.address); }}
                        className="py-3 text-[1.05rem]"
                      >
                        길안내 시작
                      </Button>
                    </div>
                  </div>
                ))})()}
              </div>
            )}
          </div>
        )}

        {/* 오늘의 경로: 오늘 방문 예정(날짜 지정 또는 반복 요일)인 곳만 모아
            최근접 삽입 휴리스틱으로 방문 순서를 매겨 보여준다. */}
        {activeTab === 'route' && (
          <div className="absolute inset-0 overflow-y-auto px-4 pt-[160px] pb-32 bg-[#FBFAF7]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-black text-[#12203D]">오늘의 방문 순서</p>
                <p className="text-sm text-slate-400 font-semibold">
                  직선거리 기준 추천 순서예요 · 총 {todayRoute.length}곳
                </p>
              </div>
              <Button
                variant="ghost"
                loading={isSyncingCalendar}
                onClick={handleSyncToCalendar}
                className="py-2 text-sm whitespace-nowrap"
              >
                구글 캘린더 동기화
              </Button>
            </div>

            {todayRoute.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 mt-16">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                  <IconNavigation size={32} className="text-slate-300" />
                </div>
                <p className="font-bold text-lg text-slate-500">오늘 방문 예정인 어르신이 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {todayRoute.map((marker, i) => {
                  const completed = isCompletedToday(marker);
                  return (
                    <div
                      key={marker.id}
                      className={`rounded-xl border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] bg-white p-4 flex gap-3 items-start ${completed ? 'opacity-50' : ''}`}
                    >
                      <div className="w-8 h-8 rounded-full bg-[#12203D] text-white text-sm font-extrabold flex items-center justify-center flex-shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`font-black text-[#12203D] ${completed ? 'line-through' : ''}`}>{marker.name} 어르신</p>
                          <Chip icon={<IconClock size={12} color="#8A5A00" />} className="bg-[#FDECC8] text-[#8A5A00]">
                            {marker.visit_time && marker.visit_time !== '00:00:00' ? marker.visit_time.substring(0, 5) : '시간 미정'}
                          </Chip>
                        </div>
                        <p className="text-sm text-slate-500 font-medium mt-1 truncate">
                          {marker.address}{marker.detail_address ? ` ${marker.detail_address}` : ''}
                        </p>
                        <div className="flex gap-2 mt-3">
                          <Button
                            variant={completed ? 'ghost' : 'primary'}
                            startIcon={<IconCheck size={16} />}
                            onClick={() => toggleCompleted(marker)}
                            className="py-1.5 text-sm"
                          >
                            {completed ? '완료 취소' : '완료'}
                          </Button>
                          <Button
                            variant="dark"
                            startIcon={<IconNavigation size={16} />}
                            onClick={() => handleDirections(marker.lat, marker.lng, marker.address)}
                            className="py-1.5 text-sm"
                          >
                            길안내
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
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
        <button
          type="button"
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
            // 강제 새로고침일 때는 예외적으로 설치 배너 닫힘 상태를 초기화
            try { localStorage.removeItem(INSTALL_DISMISSED_KEY); } catch {}
            window.location.href = window.location.pathname + '?t=' + Date.now();
          }}
          className="w-10 h-10 flex items-center justify-center rounded-2xl shadow-lg bg-red-500 text-white hover:bg-red-600 transition active:scale-95"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path></svg>
        </button>

        {activeTab === 'map' && (
          <>
            {/* 행정구역 토글 버튼 */}
            <button
              type="button"
              onClick={() => setShowRegions(!showRegions)}
              className={`w-10 h-10 flex items-center justify-center rounded-2xl shadow-lg transition active:scale-95 ${showRegions ? 'bg-[#12203D] text-white' : 'bg-white text-slate-600'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
            </button>

            {/* 확대/축소 버튼 */}
            <button
              type="button"
              onClick={() => setMapZoom(prev => Math.min(prev + 1, 21))}
              className="w-10 h-10 mt-1 flex items-center justify-center rounded-2xl shadow-lg bg-white transition active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
            <button
              type="button"
              onClick={() => setMapZoom(prev => Math.max(prev - 1, 6))}
              className="w-10 h-10 flex items-center justify-center rounded-2xl shadow-lg bg-white transition active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>

            {/* 내 위치 버튼 */}
            <button
              type="button"
              onClick={handleMyLocation}
              disabled={isLocating}
              className="w-10 h-10 mt-1 flex items-center justify-center rounded-2xl shadow-lg bg-white transition active:scale-95 disabled:opacity-60"
            >
              {isLocating ? (
                <Spinner size={18} className="text-[#12203D]" />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#12203D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19 12h2"></path><path d="M3 12h2"></path><path d="M12 3v2"></path><path d="M12 19v2"></path><circle cx="12" cy="12" r="8"></circle></svg>
              )}
            </button>
          </>
        )}
      </div>

      <button
        type="button"
        aria-label="어르신 추가"
        onClick={() => { setEditingRecipient(null); setIsModalOpen(true); }}
        className="absolute bottom-[100px] right-6 z-40 w-14 h-14 flex items-center justify-center rounded-2xl shadow-[0_4px_14px_rgba(245,165,36,0.45)] bg-[#F5A524] text-[#12203D] transition active:scale-95"
      >
        <IconPlus size={32} strokeWidth={2.5} />
      </button>

      {/* Map Marker Popup (비중을 줄인 컴팩트 버전) */}
      <BottomSheet open={Boolean(selectedRecipient && activeTab === 'map')} onClose={() => setSelectedRecipient(null)}>
        {selectedRecipient && (
          <div className="p-4 pb-11">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <p className="font-extrabold text-[#12203D] whitespace-nowrap">
                  {selectedRecipient.name} 어르신
                </p>
                <Chip icon={<IconClock size={12} color="#475569" />} className="h-[22px] text-[11px] bg-slate-100 text-slate-600">
                  {`${selectedRecipient.notes ? selectedRecipient.notes.substring(5) + ' ' : ''}${selectedRecipient.visit_time.substring(0, 5) === '00:00' ? '시간 미정' : selectedRecipient.visit_time.substring(0, 5)}`}
                </Chip>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <IconButton onClick={() => toggleCompleted(selectedRecipient)} className={isCompletedToday(selectedRecipient) ? 'bg-[#4C7A6B] text-white' : 'hover:bg-slate-100'} aria-label="오늘 방문 완료 체크">
                  <IconCheck size={16} />
                </IconButton>
                <IconButton onClick={() => { setIsModalOpen(true); setEditingRecipient(selectedRecipient); }} className="hover:bg-slate-100">
                  <IconPencil size={16} />
                </IconButton>
                <IconButton onClick={() => handleDelete(selectedRecipient.id)} className="text-red-500 hover:bg-red-50">
                  <IconTrash size={16} />
                </IconButton>
                <IconButton onClick={() => setSelectedRecipient(null)} className="hover:bg-slate-100">
                  <IconX size={16} />
                </IconButton>
              </div>
            </div>
            <p className="text-slate-500 font-medium mb-3 flex items-start gap-1">
              <IconMapPin size={14} className="flex-shrink-0 mt-0.5" />
              {selectedRecipient.address}{selectedRecipient.detail_address ? ` ${selectedRecipient.detail_address}` : ''}
            </p>
            <Button
              fullWidth
              variant="dark"
              startIcon={<IconNavigation size={18} />}
              onClick={() => handleDirections(selectedRecipient.lat, selectedRecipient.lng, selectedRecipient.address)}
              className="text-[0.95rem]"
            >
              길안내 시작
            </Button>
          </div>
        )}
      </BottomSheet>

      {/* Redesigned Bottom Navigation */}
      <div className="absolute bottom-0 left-0 right-0 z-50 rounded-t-2xl overflow-hidden shadow-[0_-10px_40px_rgba(0,0,0,0.08)] bg-white">
        <div className="flex h-20 pb-[env(safe-area-inset-bottom)]">
          <button
            type="button"
            onClick={() => setActiveTab('map')}
            className={`flex-1 flex flex-col items-center justify-center gap-1 text-xs transition-colors ${activeTab === 'map' ? 'text-[#12203D] font-extrabold' : 'text-slate-400 font-semibold'}`}
          >
            <IconMapPin size={26} strokeWidth={activeTab === 'map' ? 2.5 : 2} />
            지도 보기
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('list')}
            className={`flex-1 flex flex-col items-center justify-center gap-1 text-xs transition-colors ${activeTab === 'list' ? 'text-[#12203D] font-extrabold' : 'text-slate-400 font-semibold'}`}
          >
            <IconList size={26} strokeWidth={activeTab === 'list' ? 2.5 : 2} />
            명단 보기
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('route')}
            className={`flex-1 flex flex-col items-center justify-center gap-1 text-xs transition-colors ${activeTab === 'route' ? 'text-[#12203D] font-extrabold' : 'text-slate-400 font-semibold'}`}
          >
            <IconNavigation size={26} strokeWidth={activeTab === 'route' ? 2.5 : 2} />
            오늘의 경로
          </button>
        </div>
      </div>

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
