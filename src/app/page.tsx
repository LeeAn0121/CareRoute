'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { Container, NaverMap, Marker } from 'react-naver-maps';
import { IconLayoutGrid, IconListDetails, IconSettings, IconMapPin, IconList, IconPlus, IconNavigation, IconClock, IconUser, IconMenu2, IconMap, IconMinus, IconCurrentLocation, IconUserPlus, IconDownload, IconShare, IconX, IconSearch, IconChevronRight, IconCheck, IconPencil, IconTrash, IconCar, IconMessageCircle } from '@tabler/icons-react';
import { supabase } from '@/lib/supabase';
import RecipientModal from '@/components/RecipientModal';
import VoiceMemoModal from '@/components/VoiceMemoModal';
import Tour from '@/components/Tour';
import SettingsView from '@/components/SettingsView';
import WeatherWidget from '@/components/WeatherWidget';
import { Button, IconButton, NativeSelect, Chip, Modal, Spinner } from '@/components/ui';
import { motion, AnimatePresence } from 'motion/react';

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
  door_passcode?: string | null;
  parking_memo?: string | null;
  health_tags?: string | null;
  last_completed_memo?: string | null;
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

  // 내 위치 추적용 ID
  const watchIdRef = useRef<number | null>(null);

  const handleMyLocation = () => {
    if (!navigator.geolocation) {
      alert("GPS를 지원하지 않는 기기입니다.");
      return;
    }
    setIsLocating(true);

    const onSuccess = (position: GeolocationPosition) => {
      setIsLocating(false);
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      setMapCenter({ lat, lng });
      setMyLocation({ lat, lng });
      setMapZoom(17);

      // 한 번 버튼을 누른 이후부터는 위치를 계속 추적해서 파란 점을 이동시킴
      if (watchIdRef.current === null) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          (err) => console.warn("Watch position error:", err),
          { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
        );
      }
    };

    const describeError = (error: GeolocationPositionError) => {
      if (error.code === error.PERMISSION_DENIED) {
        return '위치 권한이 거부되어 있습니다. 브라우저(또는 기기 설정)에서 케어루트의 위치 접근을 허용해주세요.';
      }
      if (error.code === error.POSITION_UNAVAILABLE) {
        return '현재 위치를 확인할 수 없습니다. GPS/Wi-Fi가 켜져 있는지, 실외인지 확인해주세요.';
      }
      return '위치 확인이 너무 오래 걸려 실패했습니다. 신호가 약한 곳일 수 있어요. 다시 시도해주세요.';
    };

    // 정확도 우선으로 먼저 시도하고, 실패/타임아웃되면 더 관대한 조건으로
    // 한 번 더 재시도한다. (실내/건물 사이 등 GPS 신호가 약할 때 5초
    // 타임아웃 한 번에 바로 포기해서 '안 될 때가 많다'는 문제가 있었음)
    // 단, 권한 거부는 재시도해도 절대 성공하지 않으므로 바로 안내하고 끝낸다.
    navigator.geolocation.getCurrentPosition(
      onSuccess,
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setIsLocating(false);
          alert(describeError(error));
          return;
        }
        navigator.geolocation.getCurrentPosition(
          onSuccess,
          (error2) => {
            setIsLocating(false);
            alert(describeError(error2));
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
  const [completingRecipient, setCompletingRecipient] = useState<Recipient | null>(null);
  
  const [activeTab, setActiveTab] = useState<'map' | 'list' | 'route' | 'settings'>('map');
  const [listViewMode, setListViewMode] = useState<'list' | 'grid' | 'compact'>('list');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapZoom, setMapZoom] = useState(15);
  const [isLocating, setIsLocating] = useState(false);
  const [myLocation, setMyLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [showRegions, setShowRegions] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentAddress, setCurrentAddress] = useState('위치 파악 중...');
  const [listFilter, setListFilter] = useState<'all' | 'today' | 'incomplete' | 'completed' | 'recurring'>('all');
  const [showRegionFilter, setShowRegionFilter] = useState(false);
  const [sortMode, setSortMode] = useState<'time' | 'name' | 'distance'>('name');
  const mapRef = useRef<any>(null);
  const isAutoSelectRef = useRef(false);
  const regionsLoaded = useRef(false);
  const regionLabelsRef = useRef<any[]>([]);



  // 컴포넌트 언마운트 시 위치 추적 해제
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

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

  // ---- 행정구역 표시 관련 헬퍼: 컴포넌트 레벨로 옮겨서 아래 두 effect가 공유 ----
  const regionStyleFor = (lvl: string) => ({
    fillColor: lvl === 'dong' ? '#0ea5e9' : (lvl === 'sigungu' ? '#0d9488' : '#8b5cf6'),
    fillOpacity: 0.1,
    strokeColor: lvl === 'dong' ? '#0ea5e9' : (lvl === 'sigungu' ? '#0d9488' : '#8b5cf6'),
    strokeWeight: lvl === 'dong' ? 1 : 2,
    strokeOpacity: 0.6,
    visible: true
  });

  const regionFeaturesInView = (lvl: string, bounds: any) => {
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

  // 폴리곤/라벨 클릭 시 공통으로 쓰는 로직 (중복 제거)
  const handleRegionSelect = (lat: number, lng: number, lvl: string) => {
    if (!window.naver?.maps?.Service) return;
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
  const ensureRegionLabelMarker = (lvl: string, feature: any) => {
    const name = feature.properties.name;
    const cached = labelCache[lvl].get(name);
    if (cached) return cached;

    const centerLat = feature.properties._centerLat;
    const centerLng = feature.properties._centerLng;
    const bg = lvl === 'dong' ? 'var(--color-primary)' : (lvl === 'sigungu' ? 'var(--color-primary)' : 'var(--color-primary)');
    const fs = lvl === 'dong' ? '11px' : '13px';

    const marker = new window.naver.maps.Marker({
      position: new window.naver.maps.LatLng(centerLat, centerLng),
      icon: {
        content: `<div class="marker-wrapper" style="padding: 2px 6px; background: ${bg}; color: white; border-radius: 8px; font-size: ${fs}; font-weight: bold; border: 1px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.15); white-space: nowrap; cursor: pointer;">${name}</div>`,
        anchor: new window.naver.maps.Point(20, 10)
      }
    });
    window.naver.maps.Event.addListener(marker, 'click', () => handleRegionSelect(centerLat, centerLng, lvl));
    labelCache[lvl].set(name, marker);
    return marker;
  };

  const drawRegionLevel = (map: any, lvl: string) => {
    currentRenderedLevel = lvl;
    map.data.getAllFeature().forEach((f: any) => map.data.removeFeature(f));
    renderedFeatureKeys.sido.clear();
    renderedFeatureKeys.sigungu.clear();
    renderedFeatureKeys.dong.clear();
    ['sido', 'sigungu', 'dong'].forEach(l => {
      labelCache[l].forEach((m: any) => m.setMap(null));
    });

    const bounds = map.getBounds();
    const visible = regionFeaturesInView(lvl, bounds);

    map.data.addGeoJson({ type: 'FeatureCollection', features: visible });
    map.data.setStyle(regionStyleFor(lvl));
    visible.forEach((f: any) => {
      renderedFeatureKeys[lvl].add(f.properties.name);
      ensureRegionLabelMarker(lvl, f).setMap(map);
    });
  };

  // showRegions는 아래 "항상 켜져있는" idle 리스너 안에서 최신 값을 읽어야 하니 ref로도 보관
  const showRegionsRef = useRef(showRegions);
  useEffect(() => { showRegionsRef.current = showRegions; }, [showRegions]);

  const idleListenerRegisteredRef = useRef(false);

  // 지도 이동/확대를 React 상태(mapZoom/mapCenter)와 항상 동기화하고, 켜져
  // 있으면 행정구역 폴리곤/라벨도 함께 갱신한다. showRegions 여부와 무관하게
  // 항상 등록해야 한다 — 예전엔 이 리스너가 showRegions가 켜져 있을 때만
  // 등록되는 effect 안에 있어서, 꺼둔 채로 확대/축소하면 mapZoom 상태가 전혀
  // 갱신되지 않아 마커 클러스터링이 줌 레벨에 반응하지 않는 버그가 있었다.
  useEffect(() => {
    // effect가 한 번만 도는 타이밍에 mapRef.current가 아직 준비 안 됐을 가능성을
    // 완전히 없애기 위해, 폴링해서 준비되는 즉시 등록한다 (아래서 실제로 검증된
    // 줌 폴링과 동일한 패턴 — 한 번뿐인 effect 타이밍에 의존하지 않는다).
    const id = setInterval(() => {
      if (!mapRef.current || !window.naver?.maps?.Event || idleListenerRegisteredRef.current) return;
      idleListenerRegisteredRef.current = true;
      clearInterval(id);

      const map = mapRef.current;
      window.naver.maps.Event.addListener(map, 'idle', () => {
        setMapZoom(map.getZoom());
        const center = map.getCenter();
        setMapCenter({ lat: center.y, lng: center.x });

        if (!showRegionsRef.current || !currentRenderedLevel || !geoCache[currentRenderedLevel]) return;
        const lvl = currentRenderedLevel;
        const bounds = map.getBounds();
        const visible = regionFeaturesInView(lvl, bounds);
        const toAdd = visible.filter((f: any) => !renderedFeatureKeys[lvl].has(f.properties.name));

        if (toAdd.length > 0) {
          map.data.addGeoJson({ type: 'FeatureCollection', features: toAdd });
          map.data.setStyle(regionStyleFor(lvl));
          toAdd.forEach((f: any) => {
            renderedFeatureKeys[lvl].add(f.properties.name);
            ensureRegionLabelMarker(lvl, f).setMap(map);
          });
        }

        labelCache[lvl].forEach((m: any) => {
          if (bounds.hasLatLng(m.getPosition())) {
            if (!m.getMap()) m.setMap(map);
          } else {
            if (m.getMap()) m.setMap(null);
          }
        });
      });
    }, 300);
    return () => clearInterval(id);
  }, []);

  // Semantic Zoom (시도 -> 시군구 -> 동): 어떤 레벨을 그릴지 결정하고 데이터를 로드
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

    // 폴리곤 클릭 시 해당 구역으로 드롭다운 자동 필터링 (Reverse Geocoding)
    if (!window.naver.maps.Event.hasListener(map.data, 'click')) {
      window.naver.maps.Event.addListener(map.data, 'click', (e: any) => {
        const lat = e.feature.properties?._centerLat;
        const lng = e.feature.properties?._centerLng;
        if (!lat || !lng) return;
        handleRegionSelect(lat, lng, currentRenderedLevel);
      });
    }

    if (geoCache[level]) {
      drawRegionLevel(map, level);
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
            drawRegionLevel(map, level);
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
    if (showOnboarding) return;
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

      const { error } = await supabase.from('push_subscriptions').upsert(
        { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth },
        { onConflict: 'endpoint' }
      );
      if (error) {
        console.warn('푸시 구독 저장 실패 (Supabase RLS 확인 필요):', error.message);
      }
    };

    setupPush().catch((err) => console.warn('Push 구독 설정 실패:', err));
  }, []);

  useEffect(() => {
    if (!localStorage.getItem('careroute_tutorial_done_v2')) {
      setShowOnboarding(true);
    }
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
    if (showOnboarding) return;
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

  const handleNavi = (type: 'tmap' | 'kakao' | 'naver', lat: number, lng: number, address: string, detailAddress?: string | null) => {
    // POI 검색 실패를 방지하기 위해 도착지 명칭을 고정
    const encName = encodeURIComponent('도착지');
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isMobile = isAndroid || isIOS;

    // PC 환경 (웹 브라우저 새 탭으로 길찾기 열기)
    if (!isMobile) {
      if (type === 'kakao') {
        window.open(`https://map.kakao.com/link/to/${encName},${lat},${lng}`, '_blank');
      } else {
        window.open(`https://m.map.naver.com/route.nhn?menu=route&ename=${encName}&ex=${lng}&ey=${lat}&pathType=0&showMap=true`, '_blank');
      }
      return;
    }

    // 모바일 환경 (Android는 Intent로 완벽한 앱 실행 및 마켓 폴백 지원, iOS는 커스텀 스키마 직접 호출)
    if (type === 'kakao') {
      if (isAndroid) {
        window.location.href = `intent://navigate?name=${encName}&x=${lng}&y=${lat}&coord_type=wgs84#Intent;scheme=kakaonavi;package=com.locnall.KimGiSa;end;`;
      } else {
        window.location.href = `kakaonavi://navigate?name=${encName}&x=${lng}&y=${lat}&coord_type=wgs84`;
      }
    } else if (type === 'naver') {
      if (isAndroid) {
        window.location.href = `intent://route/car?dlat=${lat}&dlng=${lng}&dname=${encName}&appname=com.careroute#Intent;scheme=nmap;package=com.nhn.android.nmap;end;`;
      } else {
        window.location.href = `nmap://route/car?dlat=${lat}&dlng=${lng}&dname=${encName}&appname=com.careroute`;
      }
    } else if (type === 'tmap') {
      if (isAndroid) {
        window.location.href = `intent://route?goalname=${encName}&goalx=${lng}&goaly=${lat}#Intent;scheme=tmap;package=com.skt.tmap.ku;end;`;
      } else {
        window.location.href = `tmap://route?goalname=${encName}&goalx=${lng}&goaly=${lat}`;
      }
    }
  };

  const handleDirections = (lat: number, lng: number, address: string, detail: string | null = null) => {
    handleNavi('naver', lat, lng, address, detail);
  };



  // 완료 체크: last_completed_key가 "오늘 날짜"와 같으면 오늘 방문 완료로 간주.
  // 날짜가 바뀌면(다음 날/다음 예정일) 자동으로 다시 미완료 상태가 된다.
  const todayYMD = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const isCompletedToday = (r: Recipient) => r.last_completed_key === todayYMD();
  const toggleCompleted = async (r: Recipient) => {
    if (isCompletedToday(r)) {
      // 이미 완료된 상태면 완료 취소
      const key = null;
      setMarkers((prev) => prev.map((m) => (m.id === r.id ? { ...m, last_completed_key: key, last_completed_memo: null } : m)));
      await supabase.from('recipients').update({ last_completed_key: key, last_completed_memo: null }).eq('id', r.id);
    } else {
      // 미완료 상태면 일지 작성 모달 띄우기
      setCompletingRecipient(r);
    }
  };

  const handleShareReport = async (r: Recipient) => {
    const text = `[케어루트 안심 알림 💙]\n${r.name} 어르신 방문 케어를 무사히 마쳤습니다.\n\n📝 요양보호사 일지:\n${r.last_completed_memo || '특이사항 없음'}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${r.name} 어르신 방문 리포트`,
          text: text,
        });
      } catch (err) {
        console.log('Share canceled or failed', err);
      }
    } else {
      // Fallback: Copy to clipboard
      navigator.clipboard.writeText(text);
      alert("공유 기능이 지원되지 않아 일지 내용이 복사되었습니다. 카카오톡에 붙여넣기 해주세요!");
    }
  };

  const handleSaveMemo = async (memo: string) => {
    if (!completingRecipient) return;
    const key = todayYMD();
    const rId = completingRecipient.id;
    setCompletingRecipient(null); // 모달 닫기
    
    // 낙관적 업데이트
    setMarkers((prev) => prev.map((m) => (m.id === rId ? { ...m, last_completed_key: key, last_completed_memo: memo || null } : m)));
    await supabase.from('recipients').update({ last_completed_key: key, last_completed_memo: memo || null }).eq('id', rId);
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
      alert('오늘 방문 예정인 어르신이 없어서 동기화할 서비스 일정이 없습니다.');
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
    <main className="flex-1 flex flex-col h-[100dvh] relative bg-background font-sans">
      
      {/* PWA Install Banner */}
      {(!isStandalone && !installDismissed && (showInstallPrompt || isIOS)) && (
        <div className="absolute top-4 left-4 right-4 z-[60] bg-primary text-white p-4 rounded-2xl shadow-xl flex items-center justify-between animate-fade-in-down">
          <div className="flex items-center gap-3">
            <div className="bg-surface/10 p-2 rounded-xl">
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
              className="px-4 py-2 bg-accent text-primary font-bold rounded-xl text-sm shadow-sm active:scale-95 transition-transform"
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
              className="p-2 text-foreground/50"
            >
              <IconX size={20} />
            </button>
          </div>
        </div>
      )}

      {/* 오프라인 안내: 서버 연결에 실패하면 마지막으로 저장해둔 명단을 대신
          보여주는데, 그게 최신 데이터가 아닐 수 있다는 걸 알려준다. */}
      {isOffline && (
        <div className="absolute top-4 left-4 right-4 z-[60] bg-accent text-primary p-3 rounded-2xl shadow-xl flex items-center gap-2 animate-fade-in-down">
          <IconDownload size={18} className="flex-shrink-0" />
          <p className="text-sm font-bold">오프라인 상태입니다. 마지막으로 저장된 명단을 보여주고 있어요.</p>
        </div>
      )}

      {/* 앱 업데이트 안내창 */}
      {updateAvailable && (
        <div className="absolute top-4 left-4 right-4 z-[60] bg-foreground text-white p-4 rounded-2xl shadow-xl flex items-center justify-between animate-fade-in-down">
          <div className="flex items-center gap-3">
            <div className="bg-surface/15 p-2 rounded-xl">
              <IconDownload size={20} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-sm">새 버전이 있습니다</p>
              <p className="text-xs text-slate-300">지금 새로고침하면 최신 버전으로 업데이트돼요</p>
            </div>
          </div>
          <button
            onClick={handleUpdateRefresh}
            className="px-4 py-2 bg-surface text-foreground/90 font-bold rounded-xl text-sm shadow-sm active:scale-95 transition-transform whitespace-nowrap"
          >
            새로고침
          </button>
        </div>
      )}

      {/* iOS / One UI 6 Styled Floating Header */}
      {activeTab === 'map' && (
      <header className="absolute top-[env(safe-area-inset-top,0px)] left-4 right-4 z-20 flex items-start gap-3 mt-3 pointer-events-none">
        
        {/* Dynamic Island Style Address & Weather Combined */}
        <div className="flex-1 flex flex-col pointer-events-auto bg-surface/85 supports-[backdrop-filter]:bg-surface/65 backdrop-blur-[40px] saturate-200 rounded-[28px] shadow-[0_12px_40px_rgba(0,0,0,0.12)] border border-white/20 dark:border-white/10 overflow-hidden transition-all">
          
          {/* Location Pill (Header) */}
          <button 
            onClick={() => setShowRegionFilter(!showRegionFilter)}
            className="flex items-center justify-between w-full px-5 py-3.5 bg-foreground/[0.02] hover:bg-foreground/[0.06] active:bg-foreground/[0.08] transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center">
                <IconMapPin size={14} className="text-primary" />
              </div>
              <span className="text-[15px] font-black tracking-tight text-foreground/90">
                {selectedSido ? `${sidos.find(s=>s.code===selectedSido)?.name || ''} ${sigungus.find(s=>s.code===selectedSigungu)?.name?.split(' ').pop() || ''} ${dongs.find(s=>s.code===selectedDong)?.name?.split(' ').pop() || ''}`.trim() : '전체 지역 (검색하려면 탭하세요)'}
              </span>
            </div>
            <IconChevronRight size={18} className="text-foreground/40" />
          </button>

          {/* Integrated Compact Weather */}
          <div className="px-5 pb-3 pt-0 flex justify-start">
            <WeatherWidget lat={mapCenter.lat} lng={mapCenter.lng} />
          </div>
        </div>

        {/* Top-Right User Menu / Settings Button */}
        <button 
          id="tour-user-menu"
          onClick={() => setActiveTab('settings')}
          className="pointer-events-auto flex-shrink-0 w-12 h-12 flex items-center justify-center bg-surface/85 supports-[backdrop-filter]:bg-surface/65 backdrop-blur-[40px] saturate-200 rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.12)] border border-white/20 dark:border-white/10 hover:bg-foreground/[0.04] transition-all active:scale-90"
        >
          <IconMenu2 size={24} className="text-foreground/80" strokeWidth={2.5} />
        </button>

        {/* Region Filter Dropdown - iOS Menu Style */}
        {showRegionFilter && (
        <div id="tour-header" className="mt-1 p-5 bg-surface/85 supports-[backdrop-filter]:bg-surface/65 backdrop-blur-[40px] saturate-200 rounded-[32px] shadow-[0_16px_40px_rgba(0,0,0,0.12)] border border-surface-border/50 pointer-events-auto animate-in fade-in slide-in-from-top-4 w-full max-w-[320px]">
          <div className="flex items-center justify-between pb-4 border-b border-surface-border/40 mb-4">
            <span className="text-[17px] font-bold text-foreground tracking-tight">지역 설정</span>
            <button 
              onClick={() => setShowRegionFilter(false)} 
              className="w-8 h-8 flex items-center justify-center rounded-full bg-foreground/5 text-foreground/50 hover:bg-foreground/10 transition-colors"
            >
              <IconX size={18} />
            </button>
          </div>
          
          <div className="flex flex-col gap-3">
            <NativeSelect
              className="w-full !bg-foreground/5 !border-0 !rounded-2xl !py-3.5 !px-4 !text-[15px] !font-bold text-foreground focus:!ring-2 focus:!ring-primary/40 transition-all appearance-none"
              value={selectedSido}
              onChange={(e) => {
                setSelectedSido(e.target.value);
                setSelectedSigungu('');
                setSelectedDong('');
              }}
            >
              <option value="">시/도 선택</option>
              {sidos.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
            </NativeSelect>

            <NativeSelect
              className="w-full !bg-foreground/5 !border-0 !rounded-2xl !py-3.5 !px-4 !text-[15px] !font-bold text-foreground focus:!ring-2 focus:!ring-primary/40 transition-all appearance-none"
              value={selectedSigungu}
              onChange={(e) => {
                setSelectedSigungu(e.target.value);
                setSelectedDong('');
              }}
              disabled={!selectedSido}
            >
              <option value="">시/군/구 선택</option>
              {sigungus.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
            </NativeSelect>

            <NativeSelect
              className="w-full !bg-foreground/5 !border-0 !rounded-2xl !py-3.5 !px-4 !text-[15px] !font-bold text-foreground focus:!ring-2 focus:!ring-primary/40 transition-all appearance-none"
              value={selectedDong}
              onChange={(e) => setSelectedDong(e.target.value)}
              disabled={!selectedSigungu}
            >
              <option value="">읍/면/동 선택</option>
              {dongs.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
            </NativeSelect>
          </div>
        </div>
        )}
      </header>
      )}

      {/* Main Content Area */}
      <div className="flex-1 relative w-full h-full bg-surface-muted">
        
        {/* Map View */}
        <div className={`absolute inset-0 top-0 transition-opacity duration-300 ${activeTab === 'map' ? 'z-0 opacity-100' : 'opacity-0 pointer-events-none'}`} style={{ zIndex: activeTab === 'map' ? 0 : -10 }}>
          {mapLoaded ? (
            <Container id="react-naver-map" className="w-full h-full bg-surface-muted transition-all duration-500">
              <NaverMap
                ref={mapRef}
                defaultCenter={mapCenter}
                defaultZoom={mapZoom}
              >
                                                {/* 내 위치 (파란 점) */}
                {myLocation && (
                  <Marker
                    position={{ lat: myLocation.lat, lng: myLocation.lng }}
                    zIndex={999}
                    icon={{
                      content: `
                        <div class="relative flex items-center justify-center w-12 h-12 pointer-events-none">
                          <div class="absolute inset-0 bg-blue-500 rounded-full opacity-25 animate-ping"></div>
                          <div class="relative w-5 h-5 bg-blue-500 border-2 border-white rounded-full shadow-lg shadow-blue-500/50"></div>
                        </div>
                      `,
                      anchor: { x: 24, y: 24 }
                    }}
                  />
                )}
                
                {/* 전역 행정구역 날씨 맵 마커 (방해되지 않도록 작고 반투명하게) */}
                {markers.map((marker) => {
                  const isSelected = selectedRecipient?.id === marker.id;
                  return (
                    <Marker
                      key={marker.id}
                      position={{ lat: marker.lat, lng: marker.lng }}
                      onClick={() => setSelectedRecipient(marker)}
                      icon={{
                        content: `
                          <div class="marker-wrapper relative flex flex-col items-center ${isSelected ? 'scale-110 z-50' : 'scale-100'} transition-transform duration-300">
                            <div class="relative w-11 h-11 flex items-center justify-center">
                              ${isSelected ? '<div class="absolute -inset-1.5 bg-accent rounded-full opacity-60 animate-ping"></div>' : ''}
                              <div class="relative w-11 h-11 rounded-full overflow-hidden bg-primary flex items-center justify-center border-2 ${isSelected ? 'border-accent' : 'border-white'} shadow-md shadow-foreground/20 transition-colors duration-300">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                ${marker.photo_url ? `<img src="${marker.photo_url}" onerror="this.style.display='none'" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" />` : ''}
                              </div>
                            </div>
                            <div class="mt-0.5 px-1.5 py-0.5 ${isSelected ? 'bg-accent text-primary' : 'bg-surface text-primary'} text-[11px] font-bold rounded-md shadow-sm border border-surface-border whitespace-nowrap transition-colors duration-300">
                              ${marker.name}
                            </div>
                          </div>
                        `,
                        anchor: { x: 22, y: 22 }
                      }}
                    />
                  );
                })}
              </NaverMap>
            </Container>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-surface-muted text-foreground/50 px-8 text-center pt-20">
              <div className="relative w-24 h-24 flex items-center justify-center mb-6">
                <div className="absolute inset-0 rounded-full border-4 border-amber-100"></div>
                <div className="absolute inset-0 rounded-full border-4 border-accent border-t-transparent animate-spin"></div>
                <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center shadow-sm">
                  <IconMapPin size={28} className="text-primary" />
                </div>
              </div>
              <p className="font-extrabold text-xl text-foreground/70 mb-3 tracking-tight">지도 연동 대기 중</p>
              <p className="text-[15px] leading-relaxed">네이버 클라우드 서버 동기화가 지연되고 있습니다.<br/>(목록 탭은 지금 바로 정상 사용 가능합니다!)</p>
            </div>
          )}
        </div>

        {/* List View (Redesigned) */}
        {activeTab === 'list' && (
          <div className="absolute inset-0 overflow-y-auto px-4 pt-16 pb-32 bg-background">
            
            {/* 검색바 */}
            <div className="mb-3 relative">
              <input
                type="text"
                placeholder="이름 또는 주소 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface border border-surface-border/60 rounded-full py-4 pl-12 pr-10 shadow-sm text-[16px] shadow-sm font-semibold text-foreground/80 placeholder:text-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
              />
              <IconSearch size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/50" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/50 hover:text-foreground/70 bg-surface-muted p-1 rounded-full"
                >
                  <IconX size={16} />
                </button>
              )}
            </div>

            {/* 뷰 모드 + 정렬 */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex bg-surface-muted/80 p-1.5 rounded-full shadow-inner border border-surface-border/40">
                <button onClick={() => setListViewMode('list')} className={`p-1.5 rounded-lg transition-colors ${listViewMode === 'list' ? 'bg-surface text-primary shadow-sm' : 'text-foreground/40 hover:text-foreground/70'}`}><IconList size={18} /></button>
                <button onClick={() => setListViewMode('grid')} className={`p-1.5 rounded-lg transition-colors ${listViewMode === 'grid' ? 'bg-surface text-primary shadow-sm' : 'text-foreground/40 hover:text-foreground/70'}`}><IconLayoutGrid size={18} /></button>
                <button onClick={() => setListViewMode('compact')} className={`p-1.5 rounded-lg transition-colors ${listViewMode === 'compact' ? 'bg-surface text-primary shadow-sm' : 'text-foreground/40 hover:text-foreground/70'}`}><IconListDetails size={18} /></button>
              </div>
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as typeof sortMode)}
                className="bg-surface border border-surface-border/60 rounded-full px-4 py-2 text-[13px] font-bold text-foreground/80 focus:outline-none shadow-sm"
              >
                <option value="time">서비스 시간순</option>
                <option value="name">이름순</option>
                <option value="distance">거리순</option>
              </select>
            </div>

            {/* 필터 칩 */}
            <div className="flex items-center gap-2 mb-5">
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {([
                  { key: 'all', label: '전체' },
                  { key: 'today', label: '오늘 방문' },
                  { key: 'incomplete', label: '미완료' },
                  { key: 'completed', label: '완료' },
                  { key: 'recurring', label: '반복 서비스 일정' },
                ] as const).map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setListFilter(f.key)}
                    className={`px-4 py-2 rounded-full text-[13px] font-black whitespace-nowrap shadow-sm transition-all active:scale-95 ${
                      listFilter === f.key ? 'bg-primary text-white' : 'bg-surface text-foreground/60 border border-surface-border'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {(markers.length === 0) ? (
              <div className="flex flex-col items-center justify-center h-full text-foreground/50 mt-16">
                <div className="w-20 h-20 bg-surface rounded-full flex items-center justify-center shadow-sm mb-4">
                  <IconUser size={32} className="text-slate-300" />
                </div>
                <p className="font-bold text-lg text-foreground/60">이 지역엔 등록된 어르신이 없습니다.</p>
              </div>
            ) : (
              <div className={listViewMode === 'grid' ? "grid grid-cols-2 gap-3" : "space-y-4"}>
                {(() => {
                  const filteredMarkers = markers
                    .filter((marker) => {
                      const q = searchQuery.trim();
                      if (q && !marker.name.includes(q) && !marker.address.includes(q)) return false;
                      if (listFilter === 'today' && !isScheduledToday(marker)) return false;
                      if (listFilter === 'incomplete' && isCompletedToday(marker)) return false;
                      if (listFilter === 'completed' && !isCompletedToday(marker)) return false;
                      if (listFilter === 'recurring' && !marker.recurring_weekdays) return false;
                      return true;
                    })
                    .sort((a, b) => {
                      if (sortMode === 'name') return a.name.localeCompare(b.name, 'ko');
                      if (sortMode === 'distance') {
                        const da = getDistanceFromLatLonInKm(mapCenter.lat, mapCenter.lng, a.lat, a.lng);
                        const db = getDistanceFromLatLonInKm(mapCenter.lat, mapCenter.lng, b.lat, b.lng);
                        return da - db;
                      }
                      return a.visit_time.localeCompare(b.visit_time);
                    });

                  if (filteredMarkers.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center text-foreground/50 mt-12 bg-surface rounded-xl py-12 shadow-sm border border-surface-border">
                        <IconSearch size={40} className="text-slate-200 mb-4" />
                        <p className="font-bold text-lg text-foreground/60">조건에 맞는 어르신이 없습니다.</p>
                      </div>
                    );
                  }

                  return (
                  <AnimatePresence initial={false}>
                    {filteredMarkers.map((marker, index) => (
                  <motion.div
                    key={marker.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.22, delay: Math.min(index, 8) * 0.03, ease: [0.16, 1, 0.3, 1] }}
                    whileTap={{ scale: 0.98 }}
                    className={`rounded-3xl ${listViewMode === 'list' ? 'mb-3' : ''} border border-surface-border/50 shadow-md shadow-foreground/5 cursor-pointer bg-surface overflow-hidden flex flex-col hover:shadow-lg transition-all`}
                    onClick={() => {
                      setMapCenter({ lat: marker.lat, lng: marker.lng });
                      setMapZoom(17);
                      setActiveTab('map');
                      setSelectedRecipient(marker);
                    }}
                  >
                    {listViewMode === 'list' && (
                      <div className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex gap-4 items-center">
                            <div className="w-14 h-14 bg-primary/5 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                              {marker.photo_url ? (
                                <img src={marker.photo_url} alt="" className="w-full h-full object-contain" />
                              ) : (
                                <IconUser size={28} color='var(--primary)' />
                              )}
                            </div>
                            <div>
                              <p className="text-lg font-black text-primary tracking-tight">
                                {marker.name} 어르신
                              </p>
                              <Chip icon={<IconClock size={14} color="#8A5A00" />} className="mt-1 bg-accent/20 text-foreground/80 font-bold">
                                {`${marker.notes ? marker.notes.substring(5) + ' ' : ''}${marker.visit_time.substring(0, 5) === '00:00' ? '시간 미정' : marker.visit_time.substring(0, 5) + ' 방문'}`}
                              </Chip>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
                            <IconButton onClick={(e) => { e.stopPropagation(); toggleCompleted(marker); }} className={isCompletedToday(marker) ? 'bg-[#4C7A6B] text-white' : 'bg-surface-muted text-foreground/50 hover:bg-surface-border'} aria-label="완료">
                              <IconCheck size={18} />
                            </IconButton>
                          </div>
                        </div>

                        <div className="bg-surface-muted/50 rounded-2xl p-4 mb-5 flex gap-3 items-center border border-surface-border/30">
                          <IconMapPin size={22} color="#94a3b8" className="flex-shrink-0" />
                          <p className="font-semibold text-foreground/70 leading-snug">
                            {marker.address}{marker.detail_address ? ` ${marker.detail_address}` : ''}
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <Button variant="ghost" onClick={(e) => { e.stopPropagation(); setEditingRecipient(marker); setIsModalOpen(true); }} className="flex-1 py-3.5 text-[15px] font-bold rounded-2xl border border-surface-border/60 text-foreground/80">
                            수정
                          </Button>
                          <Button variant="dark" startIcon={<IconNavigation size={18} />} onClick={(e) => { e.stopPropagation(); handleDirections(marker.lat, marker.lng, marker.address, marker.detail_address); }} className="flex-[2] py-3.5 text-[15px] font-black rounded-2xl shadow-md shadow-primary/20 hover:bg-primary/90 transition-colors">
                            길안내
                          </Button>
                        </div>
                      </div>
                    )}

                    {listViewMode === 'grid' && (
                      <div className="p-4 flex flex-col h-full">
                        <div className="flex justify-between items-start mb-3">
                          <div className="w-12 h-12 bg-primary/5 rounded-full flex items-center justify-center overflow-hidden">
                            {marker.photo_url ? (
                              <img src={marker.photo_url} alt="" className="w-full h-full object-contain" />
                            ) : (
                              <IconUser size={24} color='var(--primary)' />
                            )}
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); toggleCompleted(marker); }} className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${isCompletedToday(marker) ? 'bg-[#4C7A6B] text-white' : 'bg-surface-muted text-foreground/40 hover:bg-surface-border'}`}>
                            <IconCheck size={16} />
                          </button>
                        </div>
                        <p className="text-lg font-black text-primary tracking-tight truncate">{marker.name}</p>
                        <p className="text-xs font-semibold text-accent mb-2 truncate">
                          {marker.visit_time.substring(0, 5) === '00:00' ? '시간 미정' : marker.visit_time.substring(0, 5)}
                        </p>
                        <p className="text-xs text-foreground/60 font-medium line-clamp-2 mb-4 flex-1">
                          {marker.address}
                        </p>
                        <Button variant="dark" onClick={(e) => { e.stopPropagation(); handleDirections(marker.lat, marker.lng, marker.address, marker.detail_address); }} className="py-2 text-xs w-full mt-auto">
                          길안내
                        </Button>
                      </div>
                    )}

                    {listViewMode === 'compact' && (
                      <div className="p-3 flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/5 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {marker.photo_url ? (
                            <img src={marker.photo_url} alt="" className="w-full h-full object-contain" />
                          ) : (
                            <IconUser size={20} color='var(--primary)' />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-black text-primary truncate">{marker.name}</p>
                            {isCompletedToday(marker) && <IconCheck size={14} className="text-[#4C7A6B]" />}
                          </div>
                          <p className="text-xs text-foreground/50 font-semibold truncate">
                            {marker.visit_time.substring(0, 5) === '00:00' ? '미정' : marker.visit_time.substring(0, 5)} · {marker.address}
                          </p>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); handleDirections(marker.lat, marker.lng, marker.address, marker.detail_address); }} className="p-2 bg-surface-muted text-foreground/60 rounded-full hover:bg-surface-border transition-colors flex-shrink-0">
                          <IconNavigation size={18} />
                        </button>
                      </div>
                    )}
                  </motion.div>
                    ))}
                  </AnimatePresence>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* 오늘의 경로: 오늘 방문 예정(날짜 지정 또는 반복 요일)인 곳만 모아
            최근접 삽입 휴리스틱으로 방문 순서를 매겨 보여준다. */}
        {activeTab === 'route' && (
          <div className="absolute inset-0 overflow-y-auto px-4 pt-16 pb-32 bg-background">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-black text-primary">오늘의 방문 순서</p>
                <p className="text-sm text-foreground/50 font-semibold">
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
              <div className="flex flex-col items-center justify-center h-full text-foreground/50 mt-16">
                <div className="w-20 h-20 bg-surface rounded-full flex items-center justify-center shadow-sm mb-4">
                  <IconNavigation size={32} className="text-slate-300" />
                </div>
                <p className="font-bold text-lg text-foreground/60">오늘 방문 예정인 어르신이 없습니다.</p>
              </div>
            ) : (
              <div className="relative pl-6 space-y-5 mt-4">
                {/* Vertical Timeline Line */}
                <div className="absolute top-4 bottom-8 left-[11px] w-[2px] bg-surface-border rounded-full" />
                
                {todayRoute.map((marker, i) => {
                  const completed = isCompletedToday(marker);
                  const isNext = !completed && (i === 0 || isCompletedToday(todayRoute[i-1]));

                  return (
                    <div
                      key={marker.id}
                      onClick={() => setSelectedRecipient(marker)}
                      className={`relative flex gap-4 items-start cursor-pointer transition-all ${completed ? 'opacity-60' : 'opacity-100'}`}
                    >
                      {/* Timeline Dot */}
                      <div className={`absolute -left-[24px] top-1.5 w-[24px] h-[24px] rounded-full flex items-center justify-center z-10 ${completed ? 'bg-surface-muted border-2 border-surface-border text-foreground/40' : (isNext ? 'bg-primary border-4 border-primary/20 text-primary-foreground shadow-lg shadow-primary/40' : 'bg-surface border-[3px] border-surface-border text-foreground/60')}`}>
                        {completed ? <IconCheck size={14} strokeWidth={3} /> : <span className="text-[11px] font-black">{i + 1}</span>}
                      </div>
                      
                      {/* Card Content */}
                      <div className={`flex-1 rounded-2xl border ${isNext ? 'border-primary shadow-md shadow-primary/10' : 'border-surface-border shadow-sm shadow-foreground/5'} bg-surface p-4 active:scale-[0.98] transition-transform`}>
                        <div className="flex gap-3 items-start">
                          <div className="w-12 h-12 rounded-xl bg-primary/5 flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {marker.photo_url ? (
                              <img src={marker.photo_url} alt="" className="w-full h-full object-contain" />
                            ) : (
                              <IconUser size={24} color='var(--primary)' />
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0 pt-0.5">
                            <div className="flex items-center gap-2 mb-1">
                              <p className={`font-black text-lg text-primary tracking-tight truncate ${completed ? 'line-through opacity-80' : ''}`}>{marker.name}</p>
                              {isNext && <span className="px-2 py-0.5 bg-accent text-accent-foreground text-[10px] font-black rounded-full animate-pulse shadow-sm">NEXT</span>}
                            </div>
                            <div className="flex items-center gap-1.5 mb-1 text-xs font-bold text-foreground/60">
                              <IconClock size={14} className={isNext ? 'text-accent' : ''} />
                              <span className={isNext ? 'text-accent' : ''}>
                                {marker.visit_time && marker.visit_time !== '00:00:00' ? marker.visit_time.substring(0, 5) : '시간 미정'}
                              </span>
                            </div>
                            <p className="text-xs text-foreground/60 font-medium truncate">
                              {marker.address}{marker.detail_address ? ` ${marker.detail_address}` : ''}
                            </p>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2 mt-4" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleCompleted(marker); }}
                            className={`flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${completed ? 'bg-surface-muted text-foreground/60 hover:bg-surface-border' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
                          >
                            <IconCheck size={16} />
                            {completed ? '완료 취소' : '방문 완료'}
                          </button>
                          
                          {!completed && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDirections(marker.lat, marker.lng, marker.address, marker.detail_address); }}
                              className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-sm font-bold bg-foreground text-background hover:opacity-90 transition-opacity"
                            >
                              <IconNavigation size={16} />
                              길안내
                            </button>
                          )}
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

      {activeTab === 'settings' && (
        <SettingsView onReplayTutorial={() => {
          setActiveTab('map');
          setTimeout(() => setShowOnboarding(true), 100);
        }} onBack={() => setActiveTab('map')} />
      )}

      {/* Floating Action Button (Add Recipient) */}
      {/* 우측 플로팅 버튼 스택: 헤더 높이(+노치 안전영역)만큼 아래에서 시작해서
          헤더의 시/도·군/구·동 select와 겹치지 않게 한 줄로 쌓는다. */}
      {activeTab === 'map' && (<div
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
              className={`w-10 h-10 flex items-center justify-center rounded-2xl shadow-lg transition active:scale-95 ${showRegions ? 'bg-primary text-white' : 'bg-surface text-foreground/70'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
            </button>

            {/* 확대/축소 버튼 */}
            <button
              type="button"
              onClick={() => setMapZoom(prev => Math.min(prev + 1, 21))}
              className="w-10 h-10 mt-1 flex items-center justify-center rounded-2xl shadow-lg bg-surface transition active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
            <button
              type="button"
              onClick={() => setMapZoom(prev => Math.max(prev - 1, 6))}
              className="w-10 h-10 flex items-center justify-center rounded-2xl shadow-lg bg-surface transition active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>

            {/* 내 위치 버튼 */}
            <button
              type="button"
              onClick={handleMyLocation}
              disabled={isLocating}
              className="w-12 h-12 mt-2 flex items-center justify-center rounded-[20px] shadow-[0_8px_24px_rgba(0,0,0,0.12)] bg-surface/80 backdrop-blur-[40px] saturate-200 border border-white/20 dark:border-white/10 transition-transform active:scale-90 disabled:opacity-60"
            >
              {isLocating ? (
                <Spinner size={18} className="text-primary" />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke='var(--primary)' strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19 12h2"></path><path d="M3 12h2"></path><path d="M12 3v2"></path><path d="M12 19v2"></path><circle cx="12" cy="12" r="8"></circle></svg>
              )}
            </button>
          </>
        )}
      </div>)}

      {activeTab !== 'settings' && (
      <button
        id="tour-add-button"
        type="button"
        aria-label="어르신 추가"
        onClick={() => { setEditingRecipient(null); setIsModalOpen(true); }}
        className="absolute bottom-[100px] right-5 z-40 w-[60px] h-[60px] flex items-center justify-center rounded-[24px] shadow-[0_16px_32px_rgba(0,0,0,0.2)] bg-primary text-primary-foreground border border-white/20 transition-transform active:scale-90 backdrop-blur-[40px] saturate-200"
      >
        <IconPlus size={32} strokeWidth={2.5} />
      </button>
      )}

      {/* 어르신 상세 팝업 (지도 마커 클릭, 명단 보기 클릭 공용) */}
      <Modal open={Boolean(selectedRecipient && (activeTab === 'map' || activeTab === 'route'))} onClose={() => setSelectedRecipient(null)}>
        {selectedRecipient && (
          <div>
            <div className="relative h-28 bg-gradient-to-r from-primary via-primary/90 to-accent/80">
              <IconButton
                onClick={() => setSelectedRecipient(null)}
                className="absolute top-3 right-3 bg-surface/15 text-white hover:bg-surface/25"
                aria-label="닫기"
              >
                <IconX size={18} />
              </IconButton>
              <div className="absolute left-5 -bottom-12 w-24 h-24 rounded-2xl bg-primary/5 border-4 border-white shadow-md overflow-hidden flex items-center justify-center">
                {selectedRecipient.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedRecipient.photo_url} alt="" className="w-full h-full object-contain" />
                ) : (
                  <IconUser size={40} color='var(--primary)' />
                )}
              </div>
            </div>
            <div className="px-5 pb-5 pt-14">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xl font-black text-primary tracking-tight truncate">
                    {selectedRecipient.name} 어르신
                  </p>
                  {selectedRecipient.health_tags && (
                    <div className="flex flex-wrap gap-1 mt-1.5 mb-1">
                      {selectedRecipient.health_tags.split(',').filter(Boolean).map((tag, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-red-100 text-red-700 rounded-md text-[11px] font-extrabold tracking-tight border border-red-200">
                          #{tag.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                  <Chip icon={<IconClock size={12} color="#8A5A00" />} className="mt-1 bg-accent/20 text-foreground/80 font-bold">
                    {`${selectedRecipient.notes ? selectedRecipient.notes.substring(5) + ' ' : ''}${selectedRecipient.visit_time.substring(0, 5) === '00:00' ? '서비스 시간 미정' : selectedRecipient.visit_time.substring(0, 5) + ' 방문'}`}
                  </Chip>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <IconButton onClick={() => toggleCompleted(selectedRecipient)} className={isCompletedToday(selectedRecipient) ? 'bg-[#4C7A6B] text-white' : 'bg-surface-muted text-foreground/50 hover:bg-surface-border'} aria-label="오늘 방문 완료 체크">
                    <IconCheck size={18} />
                  </IconButton>
                  <IconButton onClick={() => { setIsModalOpen(true); setEditingRecipient(selectedRecipient); }} className="bg-surface-muted text-foreground/60 hover:bg-surface-border">
                    <IconPencil size={18} />
                  </IconButton>
                  <IconButton onClick={() => handleDelete(selectedRecipient.id)} className="bg-red-50 text-red-500 hover:bg-red-200">
                    <IconTrash size={18} />
                  </IconButton>
                </div>
              </div>

              {isCompletedToday(selectedRecipient) && selectedRecipient.last_completed_memo && (
                <div className="bg-[#4C7A6B]/10 border border-[#4C7A6B]/20 rounded-lg p-4 mt-4 relative">
                  <div className="absolute -top-3 left-4 bg-surface px-2 text-[11px] font-black text-[#4C7A6B]">오늘의 방문 일지</div>
                  <p className="text-[13px] font-medium text-foreground/80 whitespace-pre-wrap">
                    {selectedRecipient.last_completed_memo}
                  </p>
                  <div className="mt-3 flex justify-end">
                    <button 
                      onClick={() => handleShareReport(selectedRecipient)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#4C7A6B] text-white rounded-full text-[11px] font-bold shadow-md hover:bg-[#3b6054] transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                      가족에게 안심 전송
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-surface-muted rounded-lg p-4 mt-4 flex flex-col gap-3">
                <div className="flex gap-3 items-center">
                  <IconMapPin size={20} color="#94a3b8" className="flex-shrink-0" />
                  <p className="font-semibold text-foreground/70 leading-snug text-sm">
                    {selectedRecipient.address}{selectedRecipient.detail_address ? ` ${selectedRecipient.detail_address}` : ''}
                  </p>
                </div>
                {/* 긴급/주변 시설 검색 (응급실, 약국) */}
                <div className="flex gap-2 ml-8">
                  <button
                    onClick={() => window.open(`https://m.map.naver.com/search2/search.naver?query=%EC%95%BD%EA%B5%AD&sm=sug&style=v5&x=${selectedRecipient.lng}&y=${selectedRecipient.lat}`, '_blank')}
                    className="flex-1 py-1.5 bg-white border border-surface-border rounded text-[11px] font-bold text-foreground/70 flex items-center justify-center gap-1 shadow-sm active:scale-95"
                  >
                    💊 주변 약국
                  </button>
                  <button
                    onClick={() => window.open(`https://m.map.naver.com/search2/search.naver?query=%EB%B3%91%EC%9B%90&sm=sug&style=v5&x=${selectedRecipient.lng}&y=${selectedRecipient.lat}`, '_blank')}
                    className="flex-1 py-1.5 bg-white border border-surface-border rounded text-[11px] font-bold text-foreground/70 flex items-center justify-center gap-1 shadow-sm active:scale-95"
                  >
                    🏥 주변 병원
                  </button>
                </div>
              </div>

              {(selectedRecipient.door_passcode || selectedRecipient.parking_memo) && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  {selectedRecipient.door_passcode && (
                    <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 flex flex-col items-center justify-center text-center">
                      <span className="text-[11px] font-black text-amber-700 mb-1">공동현관 비밀번호</span>
                      <span className="text-[15px] font-extrabold text-amber-900">{selectedRecipient.door_passcode}</span>
                    </div>
                  )}
                  {selectedRecipient.parking_memo && (
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex flex-col items-center justify-center text-center">
                      <span className="text-[11px] font-black text-blue-700 mb-1">주차 꿀팁 메모</span>
                      <span className="text-[13px] font-bold text-blue-900 leading-tight">{selectedRecipient.parking_memo}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-5 flex flex-col gap-2.5">
                <span className="text-[12px] font-black text-foreground/50 ml-1">원클릭 길안내 (앱 연결)</span>
                <div className="flex gap-4 px-1">
                  <button
                    onClick={() => handleNavi('tmap', selectedRecipient.lat, selectedRecipient.lng, selectedRecipient.address, selectedRecipient.detail_address)}
                    className="flex flex-col items-center gap-1.5 transition-transform hover:scale-105 active:scale-95"
                  >
                    <div className="w-12 h-12 rounded-[14px] shadow-sm bg-white overflow-hidden border border-surface-border flex items-center justify-center p-1.5">
                      <img src="https://www.tmapmobility.com/favicon.ico" alt="T맵" className="w-full h-full object-contain" />
                    </div>
                    <span className="text-[10px] font-bold text-foreground/70">T맵</span>
                  </button>

                  <button
                    onClick={() => handleNavi('kakao', selectedRecipient.lat, selectedRecipient.lng, selectedRecipient.address, selectedRecipient.detail_address)}
                    className="flex flex-col items-center gap-1.5 transition-transform hover:scale-105 active:scale-95"
                  >
                    <div className="w-12 h-12 rounded-[14px] shadow-sm bg-white overflow-hidden border border-surface-border flex items-center justify-center p-1.5">
                      <img src="https://map.kakao.com/favicon.ico" alt="카카오내비" className="w-full h-full object-contain" />
                    </div>
                    <span className="text-[10px] font-bold text-foreground/70">카카오내비</span>
                  </button>

                  <button
                    onClick={() => handleNavi('naver', selectedRecipient.lat, selectedRecipient.lng, selectedRecipient.address, selectedRecipient.detail_address)}
                    className="flex flex-col items-center gap-1.5 transition-transform hover:scale-105 active:scale-95"
                  >
                    <div className="w-12 h-12 rounded-[14px] shadow-sm bg-white overflow-hidden border border-surface-border flex items-center justify-center p-1.5">
                      <img src="https://ssl.pstatic.net/static/maps/assets/icons/favicon.ico" alt="네이버지도" className="w-full h-full object-contain" />
                    </div>
                    <span className="text-[10px] font-bold text-foreground/70">네이버지도</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Redesigned Bottom Navigation */}
      <div className={`absolute bottom-6 left-4 right-4 z-50 px-2 pb-safe transition-transform duration-500 ${activeTab === 'settings' ? 'translate-y-[150%]' : 'translate-y-0'}`}>
        <div id="tour-bottom-nav" className="rounded-[36px] overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.12)] bg-surface/75 backdrop-blur-[40px] saturate-200 border border-white/20 dark:border-white/10 supports-[backdrop-filter]:bg-surface/50">
          <div className="flex h-16">
          {([
            { key: 'map' as const, label: '지도 보기', Icon: IconMapPin },
            { key: 'list' as const, label: '명단 보기', Icon: IconList },
            { key: 'route' as const, label: '오늘의 경로', Icon: IconNavigation },
            
          ]).map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`relative flex-1 flex flex-col items-center justify-center gap-1 text-xs transition-colors ${activeTab === key ? 'text-primary font-extrabold' : 'text-foreground/50 font-semibold'}`}
            >
              {activeTab === key && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute top-0 inset-x-5 h-[4px] rounded-full bg-primary shadow-[0_2px_8px_rgba(var(--primary),0.5)]"
                  transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                />
              )}
              <Icon size={26} strokeWidth={activeTab === key ? 2.5 : 2} />
              {label}
            </button>
          ))}
        </div>
        </div>
      </div>

      <VoiceMemoModal
        isOpen={Boolean(completingRecipient)}
        onClose={() => setCompletingRecipient(null)}
        onSave={handleSaveMemo}
        recipientName={completingRecipient?.name || ''}
      />

      <RecipientModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={() => {
          setIsModalOpen(false);
          window.location.reload(); // 강제 새로고침
        }}
        recipientToEdit={editingRecipient}
      />

      {showOnboarding && <Tour onComplete={() => {
        localStorage.setItem('careroute_tutorial_done_v2', 'true');
        setShowOnboarding(false);
      }} />}
    </main>
  );
}

import dynamic from 'next/dynamic';
export default dynamic(() => Promise.resolve(MainApp), { ssr: false });
