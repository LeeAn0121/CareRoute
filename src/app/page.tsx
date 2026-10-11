'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { Container, NaverMap, Marker } from 'react-naver-maps';
import { IconLayoutGrid, IconListDetails, IconSettings, IconMapPin, IconList, IconPlus, IconNavigation, IconClock, IconCalendarEvent, IconUser, IconMenu2, IconMap, IconMinus, IconCurrentLocation, IconUserPlus, IconDownload, IconShare, IconX, IconSearch, IconChevronRight, IconCheck, IconPencil, IconTrash, IconCar, IconMessageCircle, IconBellRinging, IconChevronUp, IconChevronDown, IconArrowsSort, IconRotate2 } from '@tabler/icons-react';
import { supabase } from '@/lib/supabase';
import { registerPushSubscription } from '@/lib/notifications';
import RecipientModal from '@/components/RecipientModal';
import ScheduleAddModal from '@/components/ScheduleAddModal';
import ScheduleManageModal from '@/components/ScheduleManageModal';
import MonthCalendar from '@/components/MonthCalendar';
import VoiceMemoModal from '@/components/VoiceMemoModal';
import ShareReportModal from '@/components/ShareReportModal';
import Tour from '@/components/Tour';
import SettingsView from '@/components/SettingsView';
import WeatherWidget from '@/components/WeatherWidget';
import { Button, IconButton, NativeSelect, Chip, Modal, Spinner } from '@/components/ui';
import { motion, AnimatePresence } from 'motion/react';
import { parseVisitTime } from '@/lib/visitTime';

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
  const [sharingRecipient, setSharingRecipient] = useState<Recipient | null>(null);
  const [scheduleDate, setScheduleDate] = useState<Date | null>(new Date());
  const [isScheduleAddOpen, setIsScheduleAddOpen] = useState(false);
  const [managingScheduleRecipient, setManagingScheduleRecipient] = useState<Recipient | null>(null);
  
  const [activeTab, setActiveTab] = useState<'map' | 'list' | 'route' | 'settings'>('map');
  const [listViewMode, setListViewMode] = useState<'list' | 'grid' | 'compact'>('list');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [isSplashVisible, setIsSplashVisible] = useState(true);

  // 로딩 화면이 너무 빨리 사라지는 것을 방지 (최소 1.5초 유지)
  useEffect(() => {
    if (mapLoaded && dataLoaded) {
      const timer = setTimeout(() => setIsSplashVisible(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [mapLoaded, dataLoaded]);
  const [mapZoom, setMapZoom] = useState(15);
  const [isLocating, setIsLocating] = useState(false);
  const [myLocation, setMyLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [showRegions, setShowRegions] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentAddress, setCurrentAddress] = useState('위치 파악 중...');

  // Reverse Geocode for Top Bar Address
  useEffect(() => {
    let isMounted = true;
    if (window.naver && window.naver.maps && window.naver.maps.Service && mapCenter) {
      window.naver.maps.Service.reverseGeocode({
        coords: new window.naver.maps.LatLng(mapCenter.lat, mapCenter.lng),
        orders: [
          window.naver.maps.Service.OrderType.ROAD_ADDR,
          window.naver.maps.Service.OrderType.ADDR
        ].join(',')
      }, function(status: any, response: any) {
        if (status === window.naver.maps.Service.Status.OK && isMounted) {
          const result = response.v2;
          // Use roadAddress if available, otherwise jibunAddress
          const roadAddr = result.address?.roadAddress;
          const jibunAddr = result.address?.jibunAddress;
          let finalAddr = roadAddr || jibunAddr;
          
          if (!finalAddr && result.results && result.results.length > 0) {
             // Fallback: construct it manually from results if SDK didn't provide address object
             for (const res of result.results) {
               const region = res.region;
               const land = res.land;
               if (!region) continue;
               
               const sido = region.area1?.name || '';
               const sigungu = region.area2?.name || '';
               const dong = region.area3?.name || '';
               
               if (res.name === 'roadaddr' && land) {
                 const roadName = land.name || '';
                 const buildingNum = land.number1 || '';
                 finalAddr = `${sido} ${sigungu} ${roadName} ${buildingNum}`.trim();
                 break;
               } else if (res.name === 'addr' && land) {
                 const landNum1 = land.number1 || '';
                 const landNum2 = land.number2 ? `-${land.number2}` : '';
                 finalAddr = `${sido} ${sigungu} ${dong} ${landNum1}${landNum2}`.trim();
               }
               
               if (!finalAddr) {
                 finalAddr = `${sido} ${sigungu} ${dong}`.trim();
               }
             }
          }
          
          if (finalAddr) {
            setCurrentAddress(finalAddr);
          }
        }
      });
    }
    return () => { isMounted = false; };
  }, [mapCenter]);
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

  // 실시간 방문 알림 상태
  const [activeVisitAlert, setActiveVisitAlert] = useState<{ recipient: Recipient; timeStr: string } | null>(null);
  const notifiedKeysRef = useRef<Set<string>>(new Set());

  // Push 알림 자동 동기화: 이미 알림 권한이 허용된 경우 백그라운드 웹푸시 구독을 갱신/등록
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      registerPushSubscription().catch((err) => console.warn('Push 구독 자동 갱신 실패:', err));
    }
  }, []);

  // 포그라운드 방문 예정 시간 실시간 리마인더 (앱 사용 중 30초 간격 체크)
  useEffect(() => {
    const checkScheduledVisits = () => {
      if (!markers || markers.length === 0) return;
      const now = new Date();
      const currentHM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const ymd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      // 오늘 방문 예정 어르신 목록
      const scheduledToday = markers.filter((r) => getScheduledForDate(r, now));

      for (const recipient of scheduledToday) {
        const parsedTime = parseVisitTime(recipient.visit_time, recipient.notes);
        if (!parsedTime.hasTime || !parsedTime.startTime) continue;
        const timePrefix = parsedTime.startTime;

        // 현재 분과 방문 시작 시간이 일치할 때 알림 발송
        if (timePrefix === currentHM) {
          const alertKey = `${recipient.id}_${ymd}_${currentHM}`;
          if (!notifiedKeysRef.current.has(alertKey)) {
            notifiedKeysRef.current.add(alertKey);

            // 1. 브라우저/OS 시스템 알림 발송 (권한 허용된 경우)
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then((reg) => {
                  reg.showNotification('어르신 방문 예정 시간 알림 🚨', {
                    body: `${recipient.name} 어르신 방문 시간(${parsedTime.formattedText})입니다! (${recipient.address})`,
                    icon: '/CareRoute/icon-192.png',
                    badge: '/CareRoute/icon-192.png',
                    tag: `visit-${recipient.id}-${ymd}`,
                    data: { url: `/CareRoute/?focus=${recipient.id}`, recipientId: recipient.id },
                  });
                }).catch(() => {});
              }
            }

            // 2. 인앱 다이내믹 아일랜드 플로팅 알림 배너 노출
            setActiveVisitAlert({ recipient, timeStr: parsedTime.formattedText });
          }
        }
      }
    };

    const intervalId = setInterval(checkScheduledVisits, 30000);
    checkScheduledVisits();

    return () => clearInterval(intervalId);
  }, [markers]);

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
      if (attempts > 50) { // Increase timeout to 5 seconds
        setMapLoaded(true); // Force unlock map
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
      setDataLoaded(true); // Always unlock loading screen
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
      
      let firstAccuratePanDone = false;

      // 1. 즉시 캐시된 마지막 위치나 기지국 위치로 화면을 바로 이동 (체감 속도 0.1초)
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (selectedSido || selectedSigungu || selectedDong) return;
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setMyLocation({ lat, lng });
          
          if (!firstAccuratePanDone) {
            setMapCenter({ lat, lng });
            setMapZoom(16);
          }
        },
        () => {},
        { enableHighAccuracy: false, maximumAge: 600000, timeout: 3000 } // 최대 10분 전 캐시 허용
      );

      // 2. 동시에 고정밀 GPS 센서 추적 시작 (센서 예열 후 정확한 좌표로 보정)
      if (watchIdRef.current === null) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            setMyLocation({ lat, lng });
            
            // 최초 1회, 정확한 GPS가 잡히면 화면을 정교하게 다시 맞춰줌.
            if (!firstAccuratePanDone && !(selectedSido || selectedSigungu || selectedDong)) {
              firstAccuratePanDone = true;
              setMapCenter({ lat, lng });
              setMapZoom(16);
            }
          },
          (err) => console.warn("Watch position error:", err),
          { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
        );
      }
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

  const handleRemoveFromSchedule = async (r: Recipient, date: Date) => {
    if (!window.confirm('해당 어르신을 이 날짜의 방문 일정에서 제외하시겠습니까?')) return;
    
    const ymd = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const day = date.getDay();
    
    try {
      let newNotes = r.notes || '';
      if (newNotes.includes(ymd)) {
        newNotes = newNotes.split(',').map(s => s.trim()).filter(s => s && s !== ymd).join(',');
      }
      
      let newRecurring = r.recurring_weekdays || '';
      if (newRecurring.split(',').map(Number).includes(day)) {
        newRecurring = newRecurring.split(',').map(Number).filter(d => d !== day).join(',');
      }
      
      const { error } = await supabase.from('recipients').update({ 
        notes: newNotes || null,
        recurring_weekdays: newRecurring || null
      }).eq('id', r.id);
      
      if (error) throw error;
      
      // Update local state
      setMarkers(prev => prev.map(m => m.id === r.id ? { ...m, notes: newNotes || null, recurring_weekdays: newRecurring || null } : m));
    } catch (e) {
      console.error(e);
      alert('일정 제외 중 오류가 발생했습니다.');
    }
  };

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
    let prefType: 'tmap' | 'kakao' | 'naver' = 'naver';
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('careroute_default_navi');
      if (saved === 'kakao' || saved === 'tmap' || saved === 'naver') {
        prefType = saved;
      }
    }
    handleNavi(prefType, lat, lng, address, detail);
  };

  const handleNearbySearch = (keyword: '약국' | '병원', lat: number, lng: number) => {
    let prefType = 'naver';
    if (typeof window !== 'undefined') {
      prefType = localStorage.getItem('careroute_default_navi') || 'naver';
    }

    const encQuery = encodeURIComponent(keyword);

    if (prefType === 'kakao') {
      // 카카오맵 주변 검색
      window.open(`https://map.kakao.com/link/search/${encQuery}`, '_blank');
    } else if (prefType === 'tmap') {
      // 티맵 또는 모바일 길찾기 / 웹 검색
      window.open(`https://m.map.naver.com/search2/search.naver?query=${encQuery}&sm=sug&style=v5&x=${lng}&y=${lat}`, '_blank');
    } else {
      // 네이버 지도 주변 검색
      window.open(`https://m.map.naver.com/search2/search.naver?query=${encQuery}&sm=sug&style=v5&x=${lng}&y=${lat}`, '_blank');
    }
  };



  // 완료 체크: last_completed_key가 "오늘 날짜"와 같으면 오늘 방문 완료로 간주.
  // 날짜가 바뀌면(다음 날/다음 예정일) 자동으로 다시 미완료 상태가 된다.
  const todayYMD = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const isCompletedForDate = (r: Recipient, date: Date) => {
    const ymd = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return r.last_completed_key === ymd;
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

  const handleShareReport = (r: Recipient) => {
    setSharingRecipient(r);
  };

  const handleSaveMemo = async (memo: string) => {
    if (!completingRecipient) return;
    const key = todayYMD();
    const rId = completingRecipient.id;
    setCompletingRecipient(null); // 모달 닫기
    
    // 낙관적 업데이트
    setMarkers((prev) => prev.map((m) => (m.id === rId ? { ...m, last_completed_key: key, last_completed_memo: memo || null } : m)));
    if (selectedRecipient && selectedRecipient.id === rId) {
      setSelectedRecipient((prev) => prev ? { ...prev, last_completed_key: key, last_completed_memo: memo || null } : null);
    }
    await supabase.from('recipients').update({ last_completed_key: key, last_completed_memo: memo || null }).eq('id', rId);
  };

  const handleSaveAndShareMemo = async (memo: string) => {
    if (!completingRecipient) return;
    const target = completingRecipient;
    const key = todayYMD();
    const rId = target.id;
    setCompletingRecipient(null);

    const updated = { ...target, last_completed_key: key, last_completed_memo: memo || null };
    setMarkers((prev) => prev.map((m) => (m.id === rId ? updated : m)));
    if (selectedRecipient && selectedRecipient.id === rId) {
      setSelectedRecipient(updated);
    }
    await supabase.from('recipients').update({ last_completed_key: key, last_completed_memo: memo || null }).eq('id', rId);

    // 바로 안심 공유 모달 열기
    setSharingRecipient(updated);
  };

  // 선택한 날짜에 방문 예정인지: 특정 날짜로 지정했거나, 반복 요일에 오늘 요일이 포함되면 해당


  const getScheduledForDate = (r: Recipient, date: Date) => {
    const ymd = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    if (r.notes && r.notes.includes(ymd)) return true;
    if (r.recurring_weekdays) {
      return r.recurring_weekdays.split(',').map(Number).includes(date.getDay());
    }
    return false;
  };

  // 오늘의 경로: 시간이 정해진 일정을 뼈대로 두고, 시간 미정인 곳은 이동
  // 거리가 가장 적게 늘어나는 위치에 끼워넣는 방식(최근접 삽입 휴리스틱)으로
  // 순서를 정한다. 실제 도로 거리가 아닌 직선 거리 기준의 근사치.
  // 일정 순서 커스텀 지정 (Sortable / Reorder): 날짜(YYYY-MM-DD) -> 어르신 id 목록
  const [customOrderMap, setCustomOrderMap] = useState<Record<string, string[]>>({});

  const scheduleDateKey = scheduleDate
    ? `${scheduleDate.getFullYear()}-${String(scheduleDate.getMonth() + 1).padStart(2, '0')}-${String(scheduleDate.getDate()).padStart(2, '0')}`
    : '';

  // 로컬 스토리지에서 날짜별 커스텀 순서 불러오기
  useEffect(() => {
    if (!scheduleDateKey || typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(`careroute_order_${scheduleDateKey}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setCustomOrderMap((prev) => ({ ...prev, [scheduleDateKey]: parsed }));
        }
      }
    } catch (e) {
      console.error('Failed to load custom route order:', e);
    }
  }, [scheduleDateKey]);

  // 커스텀 순서 저장 헬퍼
  const updateCustomOrder = (newOrderIds: string[]) => {
    if (!scheduleDateKey) return;
    setCustomOrderMap((prev) => ({ ...prev, [scheduleDateKey]: newOrderIds }));
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`careroute_order_${scheduleDateKey}`, JSON.stringify(newOrderIds));
      } catch (e) {
        console.error('Failed to save custom route order:', e);
      }
    }
  };

  // 최적 경로로 순서 초기화
  const resetToOptimizedOrder = () => {
    if (!scheduleDateKey) return;
    setCustomOrderMap((prev) => {
      const next = { ...prev };
      delete next[scheduleDateKey];
      return next;
    });
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(`careroute_order_${scheduleDateKey}`);
      } catch (e) {
        console.error('Failed to reset custom route order:', e);
      }
    }
  };

  // 특정 인덱스의 순서를 위/아래로 이동
  const moveRouteItem = (index: number, direction: 'up' | 'down') => {
    const currentList = [...scheduleRoute];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentList.length) return;
    const [moved] = currentList.splice(index, 1);
    currentList.splice(targetIndex, 0, moved);
    updateCustomOrder(currentList.map(r => r.id));
  };

  // 오늘의 경로: 사용자가 직접 지정한 순서가 있으면 우선 적용하고,
  // 없을 경우 기본 알고리즘(시간 지정 일정 뼈대 + 최근접 삽입 휴리스틱)으로 정렬한다.
  const scheduleRoute = useMemo(() => {
    if (!scheduleDate) return [];
    const todays = markers.filter(r => getScheduledForDate(r, scheduleDate));
    if (todays.length === 0) return [];

    // 자동 최적화 기본 경로 계산
    let computedRoute: Recipient[] = [];
    const timed = todays
      .filter((r) => parseVisitTime(r.visit_time, r.notes).hasTime)
      .sort((a, b) => {
        const timeA = parseVisitTime(a.visit_time, a.notes).startTime;
        const timeB = parseVisitTime(b.visit_time, b.notes).startTime;
        return timeA.localeCompare(timeB);
      });
    const flexible = todays.filter((r) => !parseVisitTime(r.visit_time, r.notes).hasTime);

    if (flexible.length === 0) {
      computedRoute = timed;
    } else if (timed.length === 0) {
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
      computedRoute = route;
    } else {
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
      computedRoute = route;
    }

    // 저장된 수동 순서가 있으면 반영
    const customIds = scheduleDateKey ? customOrderMap[scheduleDateKey] : null;
    if (customIds && customIds.length > 0) {
      const idMap = new Map(todays.map(r => [r.id, r]));
      const ordered: Recipient[] = [];
      for (const id of customIds) {
        const item = idMap.get(id);
        if (item) {
          ordered.push(item);
          idMap.delete(id);
        }
      }
      // 새로 추가되어 커스텀 순서에 아직 없는 어르신은 뒤에 추가
      for (const item of computedRoute) {
        if (idMap.has(item.id)) {
          ordered.push(item);
          idMap.delete(item.id);
        }
      }
      return ordered;
    }

    return computedRoute;
  }, [markers, mapCenter, scheduleDate, scheduleDateKey, customOrderMap]);

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
    
    let targetRoute = scheduleRoute;
    let syncDate = scheduleDate;
    
    if (!syncDate) {
      syncDate = new Date();
      targetRoute = markers.filter(r => getScheduledForDate(r, syncDate as Date));
    }
    
    if (targetRoute.length === 0) {
      alert(scheduleDate ? '선택한 날짜에 방문 예정인 어르신이 없어서 동기화할 서비스 일정이 없습니다.' : '오늘 방문 예정인 어르신이 없어서 동기화할 서비스 일정이 없습니다.');
      return;
    }

    setIsSyncingCalendar(true);
    try {
      await loadGoogleScript();

      let accessToken = localStorage.getItem('google_access_token');
      const expiresAt = localStorage.getItem('google_access_token_expires');

      if (!accessToken || !expiresAt || Date.now() > parseInt(expiresAt)) {
        accessToken = await new Promise<string>((resolve, reject) => {
          const tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: 'https://www.googleapis.com/auth/calendar.events',
            callback: (resp: any) => {
              if (resp.error) reject(new Error(resp.error));
              else {
                localStorage.setItem('google_access_token', resp.access_token);
                // expires_in is usually 3599 seconds. We subtract 60s for safety buffer.
                localStorage.setItem('google_access_token_expires', (Date.now() + (resp.expires_in - 60) * 1000).toString());
                resolve(resp.access_token);
              }
            },
          });
          // prompt: '' skips the consent screen if already authorized previously
          tokenClient.requestAccessToken({ prompt: '' });
        });
      }

      const ymd = `${(syncDate as Date).getFullYear()}-${String((syncDate as Date).getMonth() + 1).padStart(2, '0')}-${String((syncDate as Date).getDate()).padStart(2, '0')}`;
      const authHeaders = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

      // 이미 동기화한 이벤트가 있는지 확인합니다.
      const existingRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?privateExtendedProperty=${encodeURIComponent(`careRouteDate=${ymd}`)}`,
        { headers: authHeaders },
      );
      const existing = await existingRes.json();
      
      // 이미 일정이 존재할 경우 사용자에게 알림을 띄우고 처리 방식을 결정합니다.
      if (existing.items && existing.items.length > 0) {
        const wantsOverwrite = window.confirm('해당 날짜에 이미 동기화된 구글 캘린더 일정이 존재합니다.\n기존 일정을 삭제하고 최신 일정으로 덮어쓰시겠습니까?\n(취소를 누르면 중복으로 추가하지 않고 작업을 중단합니다.)');
        
        if (!wantsOverwrite) {
          setIsSyncingCalendar(false);
          return; // 사용자가 취소하면 중단 (중복 방지)
        }

        // 덮어쓰기에 동의한 경우에만 기존 이벤트 삭제 진행
        for (const ev of existing.items) {
          await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${ev.id}`, {
            method: 'DELETE',
            headers: authHeaders,
          });
        }
      }

      for (const marker of targetRoute) {
        const parsedTime = parseVisitTime(marker.visit_time, marker.notes);
        const hasTime = parsedTime.hasTime;
        const body: any = {
          summary: `${marker.name} 어르신 방문`,
          location: `${marker.address}${marker.detail_address ? ` ${marker.detail_address}` : ''}`,
          extendedProperties: { private: { careRouteDate: ymd, careRouteRecipientId: marker.id } },
        };
        if (hasTime && parsedTime.startTime) {
          const startDateTime = `${ymd}T${parsedTime.startTime}:00`;
          let endDateTime = '';
          if (parsedTime.endTime) {
            endDateTime = `${ymd}T${parsedTime.endTime}:00`;
          } else {
            const endDate = new Date(startDateTime);
            endDate.setMinutes(endDate.getMinutes() + 30);
            endDateTime = `${ymd}T${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}:00`;
          }
          body.start = { dateTime: startDateTime, timeZone: 'Asia/Seoul' };
          body.end = { dateTime: endDateTime, timeZone: 'Asia/Seoul' };
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

      alert(`${(syncDate as Date).getMonth()+1}월 ${(syncDate as Date).getDate()}일 방문 일정 ${targetRoute.length}건을 구글 캘린더에 동기화했습니다.`);
    } catch (err: any) {
      console.error(err);
      alert('구글 캘린더 동기화에 실패했습니다: ' + (err?.message || err));
    } finally {
      setIsSyncingCalendar(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col h-[100dvh] relative bg-background font-sans">
      
      <AnimatePresence>
        {isSplashVisible && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[9999] bg-gradient-to-br from-primary via-[#1A2E55] to-accent flex flex-col items-center justify-center overflow-hidden"
          >
            {/* Background Ornaments */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
              <motion.div 
                initial={{ opacity: 0, scale: 0.5, rotate: -45 }}
                animate={{ opacity: 0.15, scale: 1, rotate: 0 }}
                transition={{ duration: 2, ease: "easeOut" }}
                className="absolute -top-[20%] -right-[10%] w-[70vw] h-[70vw] bg-white rounded-full blur-3xl"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.5, rotate: 45 }}
                animate={{ opacity: 0.1, scale: 1, rotate: 0 }}
                transition={{ duration: 2.5, ease: "easeOut", delay: 0.2 }}
                className="absolute -bottom-[20%] -left-[10%] w-[80vw] h-[80vw] bg-accent rounded-full blur-3xl"
              />
            </div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
              className="relative z-10 flex flex-col items-center"
            >
              <div className="w-24 h-24 bg-white/10 backdrop-blur-md border border-white/20 rounded-[32px] shadow-2xl flex items-center justify-center mb-6 relative overflow-hidden">
                <motion.div 
                  className="absolute inset-0 bg-gradient-to-tr from-accent/40 to-transparent"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                />
                <IconMapPin size={48} className="text-white drop-shadow-md relative z-10" />
              </div>
              
              <h1 className="text-4xl font-black text-white tracking-tight mb-2 drop-shadow-sm">케어루트</h1>
              <p className="text-white/80 font-medium tracking-tight">어르신 방문 요양의 새로운 기준</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.8 }}
              className="absolute bottom-16 left-0 right-0 flex flex-col items-center gap-3"
            >
              <div className="flex gap-2">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{
                      scale: [1, 1.5, 1],
                      opacity: [0.3, 1, 0.3],
                    }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      delay: i * 0.2,
                    }}
                    className="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                  />
                ))}
              </div>
              <p className="text-white/60 text-xs font-bold tracking-widest uppercase">
                {(!mapLoaded || !dataLoaded) ? '초기화 중...' : '준비 완료!'}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* 실시간 방문 예정 알림 인앱 플로팅 배너 */}
      <AnimatePresence>
        {activeVisitAlert && (
          <motion.div
            initial={{ opacity: 0, y: -60, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -60, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="fixed top-4 left-4 right-4 z-[70] max-w-lg mx-auto bg-foreground text-background p-4 rounded-[28px] shadow-2xl flex items-center justify-between border border-white/20 gap-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-amber-400 flex items-center justify-center text-foreground shrink-0 animate-bounce">
                <IconBellRinging size={22} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-400">방문 예정 알림</span>
                  <span className="text-xs text-background/60 font-bold">{activeVisitAlert.timeStr}</span>
                </div>
                <p className="font-black text-sm truncate">{activeVisitAlert.recipient.name} 어르신 댁 방문 시간입니다!</p>
                <p className="text-xs text-background/60 truncate">{activeVisitAlert.recipient.address}</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => {
                  focusRecipientById(activeVisitAlert.recipient.id);
                  setActiveVisitAlert(null);
                }}
                className="px-3.5 py-2 rounded-xl bg-primary text-primary-foreground font-black text-xs active:scale-95 shadow-md shadow-primary/30 whitespace-nowrap"
              >
                위치 보기
              </button>
              <button
                onClick={() => setActiveVisitAlert(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-background/70 active:scale-90"
              >
                <IconX size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Top-Right User Menu Button */}
      {activeTab !== 'settings' && (
        <button 
          id="tour-user-menu"
          onClick={() => setActiveTab('settings')}
          className="absolute top-[calc(env(safe-area-inset-top,0px)+12px)] right-4 z-50 flex-shrink-0 w-12 h-12 flex items-center justify-center bg-surface/85 supports-[backdrop-filter]:bg-surface/65 backdrop-blur-[40px] saturate-200 rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.12)] border border-white/20 dark:border-white/10 hover:bg-foreground/[0.04] transition-all active:scale-90 animate-fade-in-down"
        >
          <IconMenu2 size={24} className="text-foreground/80" strokeWidth={2.5} />
        </button>
      )}

      {/* iOS / One UI 6 Styled Floating Header */}
      {activeTab === 'map' && (
      <header className="absolute top-[env(safe-area-inset-top,0px)] left-4 right-4 z-20 flex flex-col items-start gap-3 mt-3 pointer-events-none">
        {/* One UI 9.0 NowBar: Address Pill + Hamburger Menu */}
        <div id="tour-header" className="flex w-full items-start gap-3 pr-[52px]">
          {/* Dynamic NowBar Capsule */}
          <div className="flex-1 flex flex-col pointer-events-auto bg-surface/85 supports-[backdrop-filter]:bg-surface/70 backdrop-blur-[40px] saturate-200 rounded-[34px] shadow-[0_16px_40px_rgba(0,0,0,0.1)] border border-white/30 dark:border-white/10 overflow-hidden transition-all">
            
            {/* Location Pill Button */}
            <button 
              onClick={() => setShowRegionFilter(!showRegionFilter)}
              className="flex items-center justify-between w-full px-5 py-3.5 hover:bg-foreground/[0.03] active:bg-foreground/[0.06] transition-colors"
            >
              <div className="flex items-start gap-3 flex-1 min-w-0 w-full">
                <div className="w-8 h-8 mt-0.5 shrink-0 rounded-[14px] bg-primary/10 flex items-center justify-center text-primary shadow-xs">
                  <IconMapPin size={18} strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <span className="text-[11px] font-black uppercase tracking-wider text-primary/70 block">현재 탐색 지역</span>
                  <span className="text-[15px] font-black tracking-tight text-foreground text-left whitespace-normal break-words leading-snug block">
                    {currentAddress}
                  </span>
                </div>
              </div>
              <div className="w-7 h-7 rounded-full bg-foreground/[0.04] flex items-center justify-center shrink-0 ml-2">
                <IconChevronRight size={16} className="text-foreground/50" />
              </div>
            </button>

            {/* Integrated Live Weather Widget Capsule */}
            <div className="px-5 pb-3.5 pt-0 flex justify-start">
              <WeatherWidget lat={mapCenter.lat} lng={mapCenter.lng} />
            </div>
          </div>
        </div>

        {/* Region Filter Dropdown - One UI 9.0 Grouped Inset Card */}
        {showRegionFilter && (
        <div className="mt-1 p-5 bg-surface/90 supports-[backdrop-filter]:bg-surface/75 backdrop-blur-[40px] saturate-200 rounded-[34px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-white/30 dark:border-white/10 pointer-events-auto animate-in fade-in slide-in-from-top-4 w-full max-w-[340px]">
          <div className="flex items-center justify-between pb-3.5 border-b border-surface-border/40 mb-4">
            <div>
              <span className="text-[17px] font-black text-foreground tracking-tight block">지역 직접 선택</span>
              <span className="text-[12px] font-bold text-foreground/50">원하는 행정구역으로 이동합니다</span>
            </div>
            <button 
              onClick={() => setShowRegionFilter(false)} 
              className="w-8 h-8 flex items-center justify-center rounded-full bg-foreground/5 text-foreground/50 hover:bg-foreground/10 transition-colors"
              aria-label="닫기"
            >
              <IconX size={18} />
            </button>
          </div>
          
          <div className="flex flex-col gap-3">
            <NativeSelect
              className="w-full !bg-foreground/[0.04] !border-0 !rounded-[20px] !py-3.5 !px-4 !text-[15px] !font-bold text-foreground focus:!ring-2 focus:!ring-primary/40 transition-all appearance-none"
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
              className="w-full !bg-foreground/[0.04] !border-0 !rounded-[20px] !py-3.5 !px-4 !text-[15px] !font-bold text-foreground focus:!ring-2 focus:!ring-primary/40 transition-all appearance-none"
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
              className="w-full !bg-foreground/[0.04] !border-0 !rounded-[20px] !py-3.5 !px-4 !text-[15px] !font-bold text-foreground focus:!ring-2 focus:!ring-primary/40 transition-all appearance-none"
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
                onIdle={() => {
                  if (mapRef.current) {
                    const center = mapRef.current.getCenter();
                    const zoom = mapRef.current.getZoom();
                    // Prevent circular updates by checking difference
                    if (Math.abs(center.y - mapCenter.lat) > 0.0001 || Math.abs(center.x - mapCenter.lng) > 0.0001) {
                      setMapCenter({ lat: center.y, lng: center.x });
                    }
                    if (zoom !== mapZoom) setMapZoom(zoom);
                  }
                }}
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
            
            {/* One UI 9.0 Search Capsule */}
            <div className="mb-3.5 relative">
              <input
                type="text"
                placeholder="어르신 성함 또는 주소 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface/90 supports-[backdrop-filter]:bg-surface/75 backdrop-blur-2xl border border-white/30 dark:border-white/10 rounded-full py-4 pl-12 pr-11 shadow-[0_8px_30px_rgba(0,0,0,0.05)] text-[16px] font-bold text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-transparent transition-all"
              />
              <IconSearch size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/45" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/50 hover:text-foreground/80 bg-foreground/[0.06] p-1.5 rounded-full transition-colors"
                  aria-label="검색어 지우기"
                >
                  <IconX size={14} />
                </button>
              )}
            </div>

            {/* View Mode Segmented Pill & Sort Dropdown */}
            <div className="flex items-center justify-between gap-2 mb-3.5 px-0.5">
              <div className="flex bg-foreground/[0.04] dark:bg-white/[0.06] p-1 rounded-full border border-surface-border/40 shadow-2xs">
                <button 
                  onClick={() => setListViewMode('list')} 
                  className={`p-2 rounded-full transition-all ${listViewMode === 'list' ? 'bg-surface text-primary shadow-xs font-black' : 'text-foreground/40 hover:text-foreground/70'}`}
                  title="목록 보기"
                >
                  <IconList size={18} />
                </button>
                <button 
                  onClick={() => setListViewMode('grid')} 
                  className={`p-2 rounded-full transition-all ${listViewMode === 'grid' ? 'bg-surface text-primary shadow-xs font-black' : 'text-foreground/40 hover:text-foreground/70'}`}
                  title="그리드 보기"
                >
                  <IconLayoutGrid size={18} />
                </button>
                <button 
                  onClick={() => setListViewMode('compact')} 
                  className={`p-2 rounded-full transition-all ${listViewMode === 'compact' ? 'bg-surface text-primary shadow-xs font-black' : 'text-foreground/40 hover:text-foreground/70'}`}
                  title="심플 보기"
                >
                  <IconListDetails size={18} />
                </button>
              </div>

              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as typeof sortMode)}
                className="bg-surface/90 border border-white/30 dark:border-white/10 rounded-full px-4 py-2.5 text-[13px] font-black text-foreground/80 focus:outline-none focus:ring-2 focus:ring-primary/30 shadow-xs cursor-pointer"
              >
                <option value="time">방문 시간순</option>
                <option value="name">어르신 이름순</option>
                <option value="distance">현재 거리순</option>
              </select>
            </div>

            {/* One UI 9.0 Filter Chips Carousel */}
            <div className="flex items-center gap-2 mb-5">
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {([
                  { key: 'all', label: '전체' },
                  { key: 'today', label: '오늘 방문' },
                  { key: 'incomplete', label: '미방문' },
                  { key: 'completed', label: '방문 완료' },
                  { key: 'recurring', label: '정기 일정' },
                ] as const).map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setListFilter(f.key)}
                    className={`px-4 py-2 rounded-full text-[13px] font-black whitespace-nowrap transition-all active:scale-95 shadow-2xs ${
                      listFilter === f.key 
                        ? 'bg-primary text-primary-foreground shadow-[0_6px_16px_rgba(var(--primary),0.3)] scale-[1.02]' 
                        : 'bg-surface/80 text-foreground/60 border border-surface-border/60 hover:bg-surface'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {(markers.length === 0) ? (
              <div className="flex flex-col items-center justify-center h-full text-foreground/50 mt-16 p-8 bg-surface/60 rounded-[32px] border border-surface-border/40 text-center">
                <div className="w-20 h-20 bg-primary/5 rounded-[24px] flex items-center justify-center shadow-xs mb-4 text-primary">
                  <IconUser size={36} />
                </div>
                <p className="font-black text-lg text-foreground/80 mb-1">등록된 어르신이 없습니다.</p>
                <p className="text-sm text-foreground/50">우측 상단 또는 지도 화면에서 새로운 어르신을 추가해보세요.</p>
              </div>
            ) : (
              <div className={listViewMode === 'grid' ? "grid grid-cols-2 gap-3.5" : "space-y-4"}>
                {(() => {
                  const filteredMarkers = markers
                    .filter((marker) => {
                      const q = searchQuery.trim();
                      if (q && !marker.name.includes(q) && !marker.address.includes(q)) return false;
                      if (listFilter === 'today' && !getScheduledForDate(marker, new Date())) return false;
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
                      const timeA = parseVisitTime(a.visit_time, a.notes).startTime || '99:99';
                      const timeB = parseVisitTime(b.visit_time, b.notes).startTime || '99:99';
                      return timeA.localeCompare(timeB);
                    });

                  if (filteredMarkers.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center text-foreground/50 mt-12 bg-surface/80 rounded-[32px] py-12 px-6 shadow-xs border border-surface-border text-center">
                        <IconSearch size={44} className="text-foreground/20 mb-3" />
                        <p className="font-black text-lg text-foreground/70 mb-1">검색 조건에 맞는 어르신이 없습니다.</p>
                        <p className="text-xs text-foreground/40">검색어나 필터 조건을 변경해보세요.</p>
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
                    className={`rounded-[32px] ${listViewMode === 'list' ? 'mb-3.5' : ''} border border-white/30 dark:border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.05)] cursor-pointer bg-surface/90 supports-[backdrop-filter]:bg-surface/80 backdrop-blur-xl overflow-hidden flex flex-col hover:shadow-xl transition-all`}
                    onClick={() => {
                      setMapCenter({ lat: marker.lat, lng: marker.lng });
                      setMapZoom(17);
                      setActiveTab('map');
                      setSelectedRecipient(marker);
                    }}
                  >
                    {/* One UI 9.0 Inset List Card */}
                    {listViewMode === 'list' && (
                      <div className="p-5">
                        <div className="flex justify-between items-start mb-3.5">
                          <div className="flex gap-3.5 items-center min-w-0">
                            <div className="w-14 h-14 bg-primary/5 rounded-[22px] flex items-center justify-center shrink-0 overflow-hidden border border-surface-border/40 shadow-2xs">
                              {marker.photo_url ? (
                                <img src={marker.photo_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <IconUser size={28} className="text-primary" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[19px] font-black text-foreground tracking-tight truncate">
                                {marker.name} 어르신
                              </p>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-accent/15 text-accent border border-accent/20">
                                  <IconClock size={12} strokeWidth={2.5} />
                                  {(() => {
                                    const parsed = parseVisitTime(marker.visit_time, marker.notes);
                                    return parsed.hasTime ? `${parsed.formattedText} 방문` : '시간 미정';
                                  })()}
                                </span>
                                {isCompletedToday(marker) && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-500/15 text-emerald-600 border border-emerald-500/20">
                                    <IconCheck size={12} strokeWidth={3} />
                                    방문 완료
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-1 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                            <IconButton 
                              onClick={(e) => { e.stopPropagation(); toggleCompleted(marker); }} 
                              className={`w-10 h-10 rounded-[18px] transition-all ${
                                isCompletedToday(marker) 
                                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30' 
                                  : 'bg-surface-muted text-foreground/50 hover:bg-surface-border'
                              }`} 
                              aria-label="방문 완료 토글"
                            >
                              <IconCheck size={18} strokeWidth={2.5} />
                            </IconButton>
                          </div>
                        </div>

                        {/* Address Box */}
                        <div className="bg-foreground/[0.03] dark:bg-white/[0.04] rounded-[22px] p-3.5 mb-4 flex gap-2.5 items-center border border-surface-border/30">
                          <IconMapPin size={20} className="text-primary/70 shrink-0" />
                          <p className="font-bold text-foreground/75 leading-snug text-[13px] line-clamp-2">
                            {marker.address}{marker.detail_address ? ` ${marker.detail_address}` : ''}
                          </p>
                        </div>

                        {/* Card Action Buttons */}
                        <div className="flex gap-2">
                          <Button 
                            variant="ghost" 
                            onClick={(e) => { e.stopPropagation(); setEditingRecipient(marker); setIsModalOpen(true); }} 
                            className="flex-1 py-3 text-[14px] font-black rounded-[18px]"
                          >
                            정보 수정
                          </Button>
                          <Button 
                            variant="dark" 
                            startIcon={<IconNavigation size={17} />} 
                            onClick={(e) => { e.stopPropagation(); handleDirections(marker.lat, marker.lng, marker.address, marker.detail_address); }} 
                            className="flex-[1.5] py-3 text-[14px] font-black rounded-[18px] shadow-md shadow-foreground/20"
                          >
                            길안내 시작
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* One UI 9.0 Inset Grid Card */}
                    {listViewMode === 'grid' && (
                      <div className="p-4 flex flex-col h-full">
                        <div className="flex justify-between items-start mb-3">
                          <div className="w-12 h-12 bg-primary/5 rounded-[18px] flex items-center justify-center overflow-hidden border border-surface-border/40 shadow-2xs shrink-0">
                            {marker.photo_url ? (
                              <img src={marker.photo_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <IconUser size={24} className="text-primary" />
                            )}
                          </div>
                          <button 
                            onClick={(e) => { e.stopPropagation(); toggleCompleted(marker); }} 
                            className={`w-9 h-9 flex items-center justify-center rounded-[14px] transition-colors ${
                              isCompletedToday(marker) ? 'bg-emerald-500 text-white shadow-sm' : 'bg-surface-muted text-foreground/40 hover:bg-surface-border'
                            }`}
                            aria-label="완료 토글"
                          >
                            <IconCheck size={16} strokeWidth={2.5} />
                          </button>
                        </div>
                        <p className="text-[17px] font-black text-foreground tracking-tight truncate">{marker.name} 어르신</p>
                        <p className="text-xs font-bold text-accent mb-2 truncate">
                          {parseVisitTime(marker.visit_time, marker.notes).formattedText}
                        </p>
                        <p className="text-xs text-foreground/60 font-semibold line-clamp-2 mb-4 flex-1 leading-relaxed">
                          {marker.address}
                        </p>
                        <Button 
                          variant="dark" 
                          onClick={(e) => { e.stopPropagation(); handleDirections(marker.lat, marker.lng, marker.address, marker.detail_address); }} 
                          className="py-2.5 text-xs w-full mt-auto rounded-[16px]"
                        >
                          길안내
                        </Button>
                      </div>
                    )}

                    {/* One UI 9.0 Inset Compact Card */}
                    {listViewMode === 'compact' && (
                      <div className="p-3.5 flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/5 rounded-[16px] flex items-center justify-center shrink-0 overflow-hidden border border-surface-border/30">
                          {marker.photo_url ? (
                            <img src={marker.photo_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <IconUser size={20} className="text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-black text-[15px] text-foreground tracking-tight truncate">{marker.name}</p>
                            {isCompletedToday(marker) && (
                              <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                                <IconCheck size={10} strokeWidth={3} />
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-foreground/50 font-bold truncate">
                            {parseVisitTime(marker.visit_time, marker.notes).formattedText} · {marker.address}
                          </p>
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDirections(marker.lat, marker.lng, marker.address, marker.detail_address); }} 
                          className="p-2.5 bg-surface-muted/80 text-foreground/70 rounded-[14px] hover:bg-surface-border transition-colors shrink-0 active:scale-95"
                          aria-label="길안내"
                        >
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
          <div className="absolute inset-0 overflow-y-auto px-4 pt-16 pb-32 bg-background flex flex-col">
            <div className="mb-2 flex items-center justify-between gap-3">
              {scheduleDate && (
                <div>
                  <p className="text-lg font-black text-primary">
                    {scheduleDate.toDateString() === new Date().toDateString() ? '오늘의 ' : `${scheduleDate.getMonth() + 1}월 ${scheduleDate.getDate()}일 `}
                    방문 일정
                  </p>
                  <p className="text-sm text-foreground/50 font-semibold">
                    총 {scheduleRoute.length}곳 방문 예정
                  </p>
                </div>
              )}

              {/* 순서 편집 및 최적화 리셋 버튼 */}
              {scheduleDate && scheduleRoute.length > 1 && (
                <div className="flex items-center gap-1.5">
                  {scheduleDateKey && customOrderMap[scheduleDateKey] && (
                    <button
                      type="button"
                      onClick={resetToOptimizedOrder}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-bold bg-surface-muted text-foreground/70 hover:bg-surface-border transition-colors shadow-2xs active:scale-95 border border-surface-border/40"
                      title="거리/시간 기준 최적 순서로 복구"
                    >
                      <IconRotate2 size={13} />
                      최적 순서
                    </button>
                  )}
                  <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-bold bg-primary/10 text-primary border border-primary/20">
                    <IconArrowsSort size={13} />
                    순서 조정 가능
                  </span>
                </div>
              )}
            </div>

            {/* Month Grid Calendar */}
            <MonthCalendar 
              selectedDate={scheduleDate} 
              onSelectDate={setScheduleDate} 
              hasSchedule={(d) => markers.some(r => getScheduledForDate(r, d))}
            />

            {scheduleDate && (
              scheduleRoute.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-foreground/50 mt-12 pb-16 animate-fade-in-up">
                  <div className="w-20 h-20 bg-surface rounded-full flex items-center justify-center shadow-sm mb-4">
                    <IconCalendarEvent size={32} className="text-slate-300" />
                  </div>
                  <p className="font-bold text-lg text-foreground/60 mb-1">일정이 없습니다.</p>
                  <p className="text-sm text-foreground/40">우측 하단 + 버튼을 눌러 어르신을 추가하세요.</p>
                </div>
              ) : (
              <div className="relative pl-6 space-y-4 mt-4">
                {/* Vertical Timeline Gradient Connector Line */}
                <div className="absolute top-4 bottom-8 left-[11px] w-[3px] bg-gradient-to-b from-primary via-accent to-surface-border rounded-full" />
                
                {scheduleRoute.map((marker, i) => {
                  const completed = isCompletedForDate(marker, scheduleDate);
                  const isNext = !completed && (i === 0 || isCompletedForDate(scheduleRoute[i-1], scheduleDate));

                  return (
                    <motion.div
                      key={marker.id}
                      layout
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => setSelectedRecipient(marker)}
                      className={`relative flex gap-3.5 items-start cursor-pointer transition-all ${completed ? 'opacity-60' : 'opacity-100'}`}
                    >
                      {/* One UI Timeline Node Squircle */}
                      <div className={`absolute -left-[25px] top-1.5 w-[26px] h-[26px] rounded-[10px] flex items-center justify-center z-10 transition-transform ${
                        completed 
                          ? 'bg-surface-muted border-2 border-surface-border text-foreground/40' 
                          : isNext 
                            ? 'bg-primary border-2 border-white dark:border-white/20 text-primary-foreground shadow-lg shadow-primary/40 scale-110' 
                            : 'bg-surface border-2 border-surface-border text-foreground/70 shadow-xs'
                      }`}>
                        {completed ? <IconCheck size={14} strokeWidth={3} /> : <span className="text-[11px] font-black">{i + 1}</span>}
                      </div>
                      
                      {/* One UI 9.0 Inset Card Content */}
                      <div className={`flex-1 min-w-0 rounded-[30px] border ${isNext ? 'border-primary/60 shadow-[0_8px_25px_rgba(var(--primary),0.15)] ring-1 ring-primary/20' : 'border-white/30 dark:border-white/10 shadow-[0_6px_20px_rgba(0,0,0,0.04)]'} bg-surface/90 backdrop-blur-xl p-4.5 transition-all`}>
                        <div className="flex gap-3.5 items-start">
                          <div className="w-13 h-13 rounded-[20px] bg-primary/5 flex items-center justify-center shrink-0 overflow-hidden border border-surface-border/40 shadow-2xs">
                            {marker.photo_url ? (
                              <img src={marker.photo_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <IconUser size={26} className="text-primary" />
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0 pt-0.5">
                            <div className="flex items-center gap-2 mb-1">
                              <p className={`font-black text-[18px] text-foreground tracking-tight truncate ${completed ? 'line-through opacity-80' : ''}`}>
                                {marker.name} 어르신
                              </p>
                              {isNext && (
                                <span className="px-2.5 py-0.5 bg-accent text-accent-foreground text-[10px] font-black rounded-full animate-pulse shadow-xs">
                                  NEXT
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mb-1.5 text-xs font-black text-foreground/60">
                              <IconClock size={14} className={isNext ? 'text-accent' : 'text-foreground/40'} />
                              <span className={isNext ? 'text-accent font-black' : ''}>
                                {parseVisitTime(marker.visit_time, marker.notes).formattedText}
                              </span>
                            </div>
                            <p className="text-xs text-foreground/60 font-semibold truncate leading-relaxed">
                              {marker.address}{marker.detail_address ? ` ${marker.detail_address}` : ''}
                            </p>
                          </div>

                          {/* 순서 조정 (위/아래 이동) 컨트롤 */}
                          {scheduleRoute.length > 1 && (
                            <div 
                              className="flex flex-col gap-1 items-center shrink-0 pl-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                disabled={i === 0}
                                onClick={(e) => { e.stopPropagation(); moveRouteItem(i, 'up'); }}
                                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                                  i === 0 
                                    ? 'opacity-25 text-foreground/30 cursor-not-allowed' 
                                    : 'bg-surface-muted hover:bg-surface-border text-foreground/70 active:scale-90 border border-surface-border/40 shadow-2xs'
                                }`}
                                aria-label="순서 위로 이동"
                                title="순서 위로 올리기"
                              >
                                <IconChevronUp size={16} strokeWidth={2.5} />
                              </button>
                              <button
                                type="button"
                                disabled={i === scheduleRoute.length - 1}
                                onClick={(e) => { e.stopPropagation(); moveRouteItem(i, 'down'); }}
                                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                                  i === scheduleRoute.length - 1 
                                    ? 'opacity-25 text-foreground/30 cursor-not-allowed' 
                                    : 'bg-surface-muted hover:bg-surface-border text-foreground/70 active:scale-90 border border-surface-border/40 shadow-2xs'
                                }`}
                                aria-label="순서 아래로 이동"
                                title="순서 아래로 내리기"
                              >
                                <IconChevronDown size={16} strokeWidth={2.5} />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* One UI Action Buttons */}
                        <div className="flex flex-wrap gap-2 mt-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-1 gap-2 min-w-[140px]">
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleCompleted(marker); }}
                              className={`flex-1 flex items-center justify-center gap-1 py-2.5 rounded-[16px] text-[13px] font-black transition-colors whitespace-nowrap active:scale-95 ${
                              completed 
                                ? 'bg-surface-muted text-foreground/60 hover:bg-surface-border' 
                                : 'bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/20'
                            }`}
                            >
                              <IconCheck size={16} strokeWidth={2.5} />
                              {completed ? '완료 취소' : '방문 완료'}
                            </button>
                            
                            {completed ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleShareReport(marker); }}
                                className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-[16px] text-[13px] font-black bg-amber-400 hover:bg-amber-500 text-stone-900 transition-colors whitespace-nowrap active:scale-95 shadow-xs"
                              >
                                <IconShare size={16} strokeWidth={2.5} />
                                안심 공유
                              </button>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDirections(marker.lat, marker.lng, marker.address, marker.detail_address); }}
                                className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-[16px] text-[13px] font-black bg-foreground text-background hover:opacity-90 transition-opacity whitespace-nowrap active:scale-95 shadow-xs"
                              >
                                <IconNavigation size={16} />
                                길안내
                              </button>
                            )}
                          </div>
                          
                          <div className="flex gap-2 min-w-fit flex-1 sm:flex-none justify-end">
                            <button
                              onClick={(e) => { e.stopPropagation(); setManagingScheduleRecipient(marker); }}
                              className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2.5 rounded-[16px] text-[13px] font-black bg-surface-muted/90 text-foreground/75 hover:bg-surface-border transition-colors whitespace-nowrap active:scale-95 border border-surface-border/40"
                            >
                              일정 관리
                            </button>
                            
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRemoveFromSchedule(marker, scheduleDate); }}
                              className="flex-shrink-0 flex items-center justify-center w-10 py-2.5 rounded-[16px] bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors active:scale-95 border border-red-500/20"
                              aria-label="일정에서 제외"
                            >
                              <IconX size={16} strokeWidth={2.5} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ))}
            
            {/* FAB for adding to schedule */}
            {scheduleDate && (
              <button
                onClick={() => setIsScheduleAddOpen(true)}
                className="fixed bottom-[100px] right-5 z-40 w-[60px] h-[60px] flex items-center justify-center rounded-[24px] shadow-[0_16px_32px_rgba(var(--primary),0.35)] bg-primary text-primary-foreground border border-white/20 transition-transform active:scale-90 backdrop-blur-[40px] saturate-200 animate-fade-in-up"
              >
                <IconPlus size={32} strokeWidth={2.5} />
              </button>
            )}
          </div>
        )}
      </div>
      
      {activeTab === 'settings' && (
        <SettingsView 
          onSyncCalendar={handleSyncToCalendar}
          isSyncingCalendar={isSyncingCalendar}
          onReplayTutorial={() => {
          setActiveTab('map');
          setTimeout(() => setShowOnboarding(true), 100);
        }} onBack={() => setActiveTab('map')} />
      )}

      {/* 맵 플로팅 컨트롤 툴바 (레이어 & 내위치) - One UI 9.0 Squircle Island */}
      {activeTab === 'map' && (
        <div id="tour-map-controls" className="absolute right-4 bottom-[104px] z-40 flex flex-col items-center gap-3.5 pointer-events-none">
          
          <div className="flex flex-col items-center bg-surface/85 supports-[backdrop-filter]:bg-surface/70 backdrop-blur-[40px] saturate-200 rounded-[28px] shadow-[0_16px_40px_rgba(0,0,0,0.12)] border border-white/30 dark:border-white/10 pointer-events-auto p-1.5 gap-1.5">
            {/* 행정구역 보기 (Map Layers) */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.90 }}
              onClick={() => setShowRegions(!showRegions)}
              className={`w-11 h-11 flex items-center justify-center rounded-[20px] transition-colors ${showRegions ? 'bg-primary text-primary-foreground shadow-md' : 'hover:bg-foreground/[0.04] text-foreground/80'}`}
              title="행정구역 경계 토글"
            >
              <IconMap size={22} strokeWidth={2.5} />
            </motion.button>
            
            <div className="w-7 h-[1px] bg-foreground/10" />

            {/* 내 위치 */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.90 }}
              onClick={handleMyLocation}
              disabled={isLocating}
              className={`w-11 h-11 flex items-center justify-center rounded-[20px] transition-colors disabled:opacity-60 ${myLocation ? 'text-primary bg-primary/10' : 'text-foreground/80 hover:bg-foreground/[0.04]'}`}
              title="내 위치로 이동"
            >
              {isLocating ? (
                <Spinner size={18} className="text-primary" />
              ) : (
                <IconCurrentLocation size={22} strokeWidth={2.5} />
              )}
            </motion.button>
          </div>

          {/* 어르신 추가 (One UI 9.0 강조형 Squircle FAB) */}
          <motion.button
            whileTap={{ scale: 0.90 }}
            onClick={() => {
              setEditingRecipient(null);
              setIsModalOpen(true);
            }}
            id="tour-add-button"
            className="w-[62px] h-[62px] flex items-center justify-center rounded-[28px] shadow-[0_16px_36px_rgba(var(--primary),0.35)] bg-primary text-primary-foreground border border-white/20 transition-transform backdrop-blur-[40px] saturate-200 pointer-events-auto"
            aria-label="어르신 추가"
          >
            <IconUserPlus size={28} strokeWidth={2.5} />
          </motion.button>
        </div>
      )}

      {/* 어르신 상세 팝업 - One UI 9.0 Hero Bottom Sheet / Dialog */}
      <Modal open={Boolean(selectedRecipient && (activeTab === 'map' || activeTab === 'route'))} onClose={() => setSelectedRecipient(null)}>
        {selectedRecipient && (
          <div className="flex flex-col">
            {/* Header Hero Cover Banner */}
            <div className="relative h-32 bg-gradient-to-br from-primary via-primary/95 to-accent/90 rounded-t-[34px] p-4 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white font-black text-xs tracking-tight">
                  CareRoute 어르신 상세
                </span>
              </div>
              <IconButton
                onClick={() => setSelectedRecipient(null)}
                className="w-9 h-9 rounded-full bg-black/25 text-white hover:bg-black/40 backdrop-blur-md"
                aria-label="닫기"
              >
                <IconX size={18} strokeWidth={2.5} />
              </IconButton>

              {/* Squircle Avatar Profile Photo */}
              <div className="absolute left-6 -bottom-10 w-22 h-22 rounded-[24px] bg-surface border-4 border-surface shadow-xl overflow-hidden flex items-center justify-center">
                {selectedRecipient.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedRecipient.photo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <IconUser size={38} className="text-primary" />
                )}
              </div>
            </div>

            <div className="px-6 pb-6 pt-12">
              {/* Senior Title & Health Tags */}
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-2xl font-black text-foreground tracking-tight">
                      {selectedRecipient.name} 어르신
                    </p>
                    {isCompletedToday(selectedRecipient) && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-500/15 text-emerald-600 border border-emerald-500/20">
                        방문 완료 ✓
                      </span>
                    )}
                  </div>

                  {selectedRecipient.health_tags && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {selectedRecipient.health_tags.split(',').filter(Boolean).map((tag, idx) => (
                        <span key={idx} className="px-2.5 py-0.5 bg-red-500/10 text-red-600 rounded-full text-xs font-black border border-red-500/20">
                          #{tag.trim()}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-2">
                    <Chip icon={<IconClock size={13} strokeWidth={2.5} className="text-accent" />} className="bg-accent/15 text-accent border border-accent/20 font-black">
                      {(() => {
                        const parsed = parseVisitTime(selectedRecipient.visit_time, selectedRecipient.notes);
                        return parsed.hasTime ? `${parsed.formattedText} 방문` : '서비스 시간 미정';
                      })()}
                    </Chip>
                  </div>
                </div>

                {/* Quick Toggle Complete & Edit Actions */}
                <div className="flex gap-1.5 shrink-0">
                  <IconButton 
                    onClick={() => toggleCompleted(selectedRecipient)} 
                    className={`w-11 h-11 rounded-[18px] transition-all ${isCompletedToday(selectedRecipient) ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30' : 'bg-surface-muted text-foreground/50 hover:bg-surface-border'}`} 
                    aria-label="방문 완료 토글"
                  >
                    <IconCheck size={20} strokeWidth={2.5} />
                  </IconButton>
                  <IconButton 
                    onClick={() => { setIsModalOpen(true); setEditingRecipient(selectedRecipient); }} 
                    className="w-11 h-11 rounded-[18px] bg-surface-muted text-foreground/70 hover:bg-surface-border"
                    aria-label="정보 수정"
                  >
                    <IconPencil size={18} />
                  </IconButton>
                  <IconButton 
                    onClick={() => handleDelete(selectedRecipient.id)} 
                    className="w-11 h-11 rounded-[18px] bg-red-500/10 text-red-500 hover:bg-red-500/20"
                    aria-label="삭제"
                  >
                    <IconTrash size={18} />
                  </IconButton>
                </div>
              </div>

              {/* One UI 9.0 Quick Action Pill Bar */}
              <div className="grid grid-cols-3 gap-2.5 my-4">
                <button
                  onClick={() => handleDirections(selectedRecipient.lat, selectedRecipient.lng, selectedRecipient.address, selectedRecipient.detail_address)}
                  className="py-3 px-2 rounded-[20px] bg-foreground text-background flex flex-col items-center justify-center gap-1 active:scale-95 transition-all shadow-sm"
                >
                  <IconNavigation size={20} />
                  <span className="text-[12px] font-black">길안내</span>
                </button>

                <button
                  onClick={() => setCompletingRecipient(selectedRecipient)}
                  className="py-3 px-2 rounded-[20px] bg-primary/10 hover:bg-primary/15 text-primary flex flex-col items-center justify-center gap-1 active:scale-95 transition-all border border-primary/20"
                >
                  <IconMessageCircle size={20} />
                  <span className="text-[12px] font-black">음성 일지</span>
                </button>

                <button
                  onClick={() => handleShareReport(selectedRecipient)}
                  className="py-3 px-2 rounded-[20px] bg-[#FEE500]/20 hover:bg-[#FEE500]/30 text-amber-900 dark:text-amber-200 flex flex-col items-center justify-center gap-1 active:scale-95 transition-all border border-amber-500/20"
                >
                  <IconShare size={20} />
                  <span className="text-[12px] font-black">안심 공유</span>
                </button>
              </div>

              {/* Today Completed Visit Memo Inset */}
              {isCompletedToday(selectedRecipient) && selectedRecipient.last_completed_memo && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-[24px] p-4 my-3 relative">
                  <div className="text-[11px] font-black uppercase tracking-wider text-emerald-600 mb-1">오늘의 방문 일지</div>
                  <p className="text-[14px] font-bold text-foreground/85 whitespace-pre-wrap leading-relaxed">
                    {selectedRecipient.last_completed_memo}
                  </p>
                </div>
              )}

              {/* Grouped Inset Address & Nearby Facilities Card */}
              <div className="bg-foreground/[0.03] dark:bg-white/[0.04] rounded-[24px] p-4 my-3 flex flex-col gap-3 border border-surface-border/40">
                <div className="flex gap-3 items-center">
                  <div className="w-8 h-8 rounded-[12px] bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <IconMapPin size={18} strokeWidth={2.5} />
                  </div>
                  <p className="font-bold text-foreground/80 leading-snug text-sm">
                    {selectedRecipient.address}{selectedRecipient.detail_address ? ` ${selectedRecipient.detail_address}` : ''}
                  </p>
                </div>

                <div className="flex gap-2 pt-1 border-t border-surface-border/30">
                  <button
                    onClick={() => handleNearbySearch('약국', selectedRecipient.lat, selectedRecipient.lng)}
                    className="flex-1 py-2 bg-surface border border-surface-border/60 rounded-full text-[12px] font-black text-foreground/75 flex items-center justify-center gap-1 shadow-2xs active:scale-95 transition-all"
                  >
                    💊 주변 약국
                  </button>
                  <button
                    onClick={() => handleNearbySearch('병원', selectedRecipient.lat, selectedRecipient.lng)}
                    className="flex-1 py-2 bg-surface border border-surface-border/60 rounded-full text-[12px] font-black text-foreground/75 flex items-center justify-center gap-1 shadow-2xs active:scale-95 transition-all"
                  >
                    🏥 주변 병원
                  </button>
                </div>
              </div>

              {/* Grouped Inset Passcode & Parking Memos */}
              {(selectedRecipient.door_passcode || selectedRecipient.parking_memo) && (
                <div className="grid grid-cols-2 gap-2.5 my-3">
                  {selectedRecipient.door_passcode && (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-[22px] p-3.5 flex flex-col items-center justify-center text-center">
                      <span className="text-[11px] font-black text-amber-600 mb-0.5">공동현관 비밀번호</span>
                      <span className="text-[16px] font-black text-amber-800 dark:text-amber-200 tracking-wider">{selectedRecipient.door_passcode}</span>
                    </div>
                  )}
                  {selectedRecipient.parking_memo && (
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-[22px] p-3.5 flex flex-col items-center justify-center text-center">
                      <span className="text-[11px] font-black text-blue-600 mb-0.5">주차 꿀팁 메모</span>
                      <span className="text-[13px] font-black text-blue-800 dark:text-blue-200 leading-tight">{selectedRecipient.parking_memo}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Navigation Deep Link App Launcher */}
              <div className="mt-4 pt-3 border-t border-surface-border/40">
                <span className="text-[12px] font-black text-foreground/50 ml-1 block mb-2.5">내비게이션 바로 실행</span>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    onClick={() => handleNavi('tmap', selectedRecipient.lat, selectedRecipient.lng, selectedRecipient.address, selectedRecipient.detail_address)}
                    className="p-3 bg-surface border border-surface-border/60 rounded-[20px] flex items-center justify-center gap-2 hover:bg-surface-muted transition-all active:scale-95 shadow-2xs"
                  >
                    <div className="w-6 h-6 rounded-[8px] overflow-hidden">
                      <img src="https://www.tmapmobility.com/favicon.ico" alt="T맵" className="w-full h-full object-contain" />
                    </div>
                    <span className="text-[13px] font-black text-foreground/80">T맵</span>
                  </button>

                  <button
                    onClick={() => handleNavi('kakao', selectedRecipient.lat, selectedRecipient.lng, selectedRecipient.address, selectedRecipient.detail_address)}
                    className="p-3 bg-surface border border-surface-border/60 rounded-[20px] flex items-center justify-center gap-2 hover:bg-surface-muted transition-all active:scale-95 shadow-2xs"
                  >
                    <div className="w-6 h-6 rounded-[8px] overflow-hidden">
                      <img src="https://map.kakao.com/favicon.ico" alt="카카오내비" className="w-full h-full object-contain" />
                    </div>
                    <span className="text-[13px] font-black text-foreground/80">카카오</span>
                  </button>

                  <button
                    onClick={() => handleNavi('naver', selectedRecipient.lat, selectedRecipient.lng, selectedRecipient.address, selectedRecipient.detail_address)}
                    className="p-3 bg-surface border border-surface-border/60 rounded-[20px] flex items-center justify-center gap-2 hover:bg-surface-muted transition-all active:scale-95 shadow-2xs"
                  >
                    <div className="w-6 h-6 rounded-[8px] overflow-hidden">
                      <img src="https://ssl.pstatic.net/static/maps/assets/icons/favicon.ico" alt="네이버지도" className="w-full h-full object-contain" />
                    </div>
                    <span className="text-[13px] font-black text-foreground/80">네이버</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* One UI 9.0 Floating Dock Navigation */}
      <div className={`absolute bottom-6 left-4 right-4 z-50 px-2 pb-safe transition-transform duration-500 ${activeTab === 'settings' ? 'translate-y-[150%]' : 'translate-y-0'}`}>
        <div id="tour-bottom-nav" className="rounded-[40px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.18)] bg-surface/80 supports-[backdrop-filter]:bg-surface/65 backdrop-blur-[40px] saturate-200 border border-white/30 dark:border-white/10 p-1.5">
          <div className="flex h-16 items-center">
            {([
              { key: 'map' as const, label: '지도 보기', Icon: IconMapPin },
              { key: 'list' as const, label: '명단 보기', Icon: IconList },
              { key: 'route' as const, label: '방문 일정', Icon: IconCalendarEvent },
            ]).map(({ key, label, Icon }) => {
              const isActive = activeTab === key;
              return (
                <motion.button
                  key={key}
                  type="button"
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setActiveTab(key)}
                  className={`relative flex-1 h-full rounded-[30px] flex flex-col items-center justify-center gap-1 text-xs transition-colors ${
                    isActive ? 'text-primary font-black' : 'text-foreground/50 font-bold hover:text-foreground/80'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="dock-active-pill"
                      className="absolute inset-1 rounded-[26px] bg-primary/10 dark:bg-white/15 -z-10 shadow-xs"
                      transition={{ type: 'spring', damping: 28, stiffness: 350 }}
                    />
                  )}
                  <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                  <span className="tracking-tight text-[11px]">{label}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      <VoiceMemoModal
        isOpen={Boolean(completingRecipient)}
        onClose={() => setCompletingRecipient(null)}
        onSave={handleSaveMemo}
        onSaveAndShare={handleSaveAndShareMemo}
        recipientName={completingRecipient?.name || ''}
        initialMemo={completingRecipient?.last_completed_memo}
      />

      <ShareReportModal
        isOpen={Boolean(sharingRecipient)}
        onClose={() => setSharingRecipient(null)}
        recipient={sharingRecipient}
        selectedDate={scheduleDate}
      />

            {isScheduleAddOpen && (
        <ScheduleAddModal 
          isOpen={isScheduleAddOpen}
          onClose={() => setIsScheduleAddOpen(false)}
          date={scheduleDate as Date}
          allRecipients={markers}
          onSuccess={() => {
            fetchMarkers();
            setIsScheduleAddOpen(false);
          }}
          onSelectRecipient={(r: any) => {
            setManagingScheduleRecipient(r);
          }}
        />
      )}
      <ScheduleManageModal
        isOpen={Boolean(managingScheduleRecipient)}
        onClose={() => setManagingScheduleRecipient(null)}
        recipient={managingScheduleRecipient}
        currentDate={scheduleDate || new Date()}
        onSuccess={() => {
          fetchMarkers();
          setManagingScheduleRecipient(null);
        }}
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
