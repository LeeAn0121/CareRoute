'use client';
import WeatherWidget from '@/components/WeatherWidget';
import { fetchWeatherForCoord, getWeatherEmojiAndDesc, weatherCache, getGridKey } from '@/lib/weather';
import { getProvinceCode } from '@/lib/regions';
import { IconMap, IconCloud } from '@tabler/icons-react';
import AuthGate from '@/components/AuthGate';
import BatchPrintModal from '@/components/BatchPrintModal';
import MapErrorBoundary from '@/components/MapErrorBoundary';
import MedicationModal from '@/components/MedicationModal';
import MonthCalendar from '@/components/MonthCalendar';
import PrintProfileModal from '@/components/PrintProfileModal';
import PrivateImage from '@/components/PrivateImage';
import RecipientModal from '@/components/RecipientModal';
import ScheduleAddModal from '@/components/ScheduleAddModal';
import ScheduleManageModal from '@/components/ScheduleManageModal';
import SettingsView from '@/components/SettingsView';
import Tour from '@/components/Tour';
import { Button, Chip, IconButton, Modal, NativeSelect, Spinner } from '@/components/ui';
import VisitCompletionModal from '@/components/VisitCompletionModal';
import VitalsHistorySheet from '@/components/VitalsHistorySheet';
import WeeklyPrintModal from '@/components/WeeklyPrintModal';
import { accountStorage, captureAccountStorage } from '@/lib/accountStorage';
import { CareRouteDevice, scheduleVisitNotifications } from '@/lib/native';
import { registerPushSubscription } from '@/lib/notifications';
import { retryPendingVisitLogs } from '@/lib/pendingVisitLogs';
import { PRIVATE_STORAGE_TTL_SECONDS, resolveRecipientPhotoUrl } from '@/lib/privateStorage';
import { loadRecipients, RecipientLoadError } from '@/lib/recipientLoader';
import { geocodeRecipientAddress, isValidCoordinates } from '@/lib/recipientLocation';
import { addressMatchesRegion, getDistricts, getNeighborhoods, PROVINCES } from '@/lib/regions';
import { supabase } from '@/lib/supabase';
import { useCurrentLocation } from '@/lib/useCurrentLocation';
import { useVisitDay, useVisitSessions } from '@/lib/useVisitSessions';
import { localDateKey, sessionKey, transitionVisitSession, VISIT_STATUS_LABEL, type VisitSession, type VisitStatus } from '@/lib/visitSessions';
import { parseVisitTime } from '@/lib/visitTime';
import { logVitals, type VitalsInput } from '@/lib/vitalsLogs';
import { Capacitor } from '@capacitor/core';
import { IconActivity, IconArrowsSort, IconBellRinging, IconCalendarEvent, IconCar, IconCheck, IconChevronDown, IconChevronUp, IconClock, IconCurrentLocation, IconDownload, IconEye, IconFileCheck, IconKey, IconLayoutGrid, IconList, IconListDetails, IconMapPin, IconMessageCircle, IconNavigation, IconPencil, IconPhone, IconPill, IconPlayerPlay, IconPlus, IconPrinter, IconRotate2, IconSearch, IconSettings, IconTrash, IconUser, IconUserPlus, IconUsers, IconX } from '@tabler/icons-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Container, Marker, NaverMap } from 'react-naver-maps';

interface Recipient {
  id: string;
  name: string;
  address: string;
  detail_address?: string | null;
  locationUnresolved?: boolean;
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
  age?: number | null;
  care_grade?: string | null;
  last_visit_started_at?: string | null;
  assigned_caregiver_name?: string | null;
  guardian_name?: string | null;
  guardian_relation?: string | null;
  guardian_phone?: string | null;
}

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

function escapeMarkerText(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

const geoCache: any = { sido: null, sigungu: null, dong: null };
// 라벨 마커는 화면에 보이는 것만 그때그때(lazy) 만들어서 재사용한다.
// (동/읍/면은 전국 약 3,500개라 미리 다 만들면 메인 스레드가 멈춘다)
const labelCache: any = { sido: new Map(), sigungu: new Map(), dong: new Map() };
// 현재 map.data에 실제로 추가되어 있는 폴리곤의 feature 이름 집합.
// idle(패닝)마다 map.data.getAllFeature()로 전수조사하지 않기 위해 직접 추적.
const renderedFeatureKeys: any = { sido: new Set(), sigungu: new Set(), dong: new Set() };
// 같은 이름의 행정구역(예: 중앙동 31개, 동구 6개)이 존재하므로 이름만으로는 구분할 수 없다.
// 이름 + 중심 좌표로 고유 키를 만들어 라벨/폴리곤 중복·누락을 방지한다.
const regionFeatureKey = (f: any): string =>
  `${f.properties.name}_${Number(f.properties._centerLat).toFixed(4)}_${Number(f.properties._centerLng).toFixed(4)}`;
let currentRenderedLevel = ''; // Track currently rendered level to prevent re-rendering




function MainApp({ accountEmail, onSignOut }: { accountEmail?: string; onSignOut: () => Promise<void> }) {

  const location = useCurrentLocation();
  const autoCenterLocation = useRef(true);
  const handleMyLocation = () => {
    autoCenterLocation.current = true;
    setSelectedSido('');
    setSelectedSigungu('');
    setSelectedDong('');
    if (location.position) {
      setMapCenter({ lat: location.position.lat, lng: location.position.lng });
      setMapZoom(17);
    }
    location.refresh();
  };

  const [showRegions, setShowRegions] = useState(false);
  const [isLayerMenuOpen, setIsLayerMenuOpen] = useState(false);
  const [showWeatherGrid, setShowWeatherGrid] = useState(() => accountStorage.getItem('careroute_show_weather_grid') === 'true');
  const showRegionsRef = useRef(showRegions);
  const showWeatherGridRef = useRef(showWeatherGrid);
  const lastRenderedKeyRef = useRef('');
  useEffect(() => { showRegionsRef.current = showRegions; showWeatherGridRef.current = showWeatherGrid; accountStorage.setItem('careroute_show_weather_grid', String(showWeatherGrid)); }, [showRegions, showWeatherGrid]);
  const regionSelectionRequest = useRef(0);
  useEffect(() => () => { regionSelectionRequest.current++; }, []);
  const [selectedSido, setSelectedSido] = useState('');
  const [selectedSigungu, setSelectedSigungu] = useState('');
  const [selectedDong, setSelectedDong] = useState('');
  useEffect(() => { regionSelectionRequest.current++; }, [selectedSido, selectedSigungu, selectedDong]);
  const sidos = PROVINCES;
  const sigungus = useMemo(() => getDistricts(selectedSido), [selectedSido]);
  const dongs = useMemo(() => getNeighborhoods(selectedSigungu), [selectedSigungu]);

  const [markers, setMarkers] = useState<Recipient[]>([]);
  const recipientRequest = useRef<AbortController | null>(null);
  const recipientGeneration = useRef(0);
  const resolvedLocations = useRef(new Map<string, { address: string; lat: number; lng: number }>());
  const [locationRefreshVersion, setLocationRefreshVersion] = useState(0);
  const [recipientsRefreshing, setRecipientsRefreshing] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => { const date = new Date(); return localDateKey(new Date(date.getFullYear(), date.getMonth(), 1)); });
  const [mapCenter, setMapCenter] = useState({ lat: 37.5665, lng: 126.9780 });
  const [selectedRecipient, setSelectedRecipient] = useState<Recipient | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [mapSearchQuery, setMapSearchQuery] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState<Recipient | null>(null);
  const [completingRecipient, setCompletingRecipient] = useState<Recipient | null>(null);
  const [completingDateKey, setCompletingDateKey] = useState('');
  const [completingVersion, setCompletingVersion] = useState(0);

  const [visitSaving, setVisitSaving] = useState(false);
  const [visitActionError, setVisitActionError] = useState('');
  const [removedSchedule, setRemovedSchedule] = useState<{ recipient: Recipient; dateKey: string; version: number; status: VisitStatus; memo: string | null } | null>(null);
  const [removingActiveVisit, setRemovingActiveVisit] = useState<{ recipient: Recipient; dateKey: string; version: number } | null>(null);
  const [showRemovedSchedules, setShowRemovedSchedules] = useState(false);
  const visitBusy = useRef(false);
  const visitRequestIds = useRef(new Map<string, string>());

  const [printingRecipient, setPrintingRecipient] = useState<Recipient | null>(null);
  const [printingDateKey, setPrintingDateKey] = useState('');
  const [isPrintMenuOpen, setIsPrintMenuOpen] = useState(false);
  const [printMenuTarget, setPrintMenuTarget] = useState<{recipient: Recipient; dateKey: string} | null>(null);
  const [isBatchPrintOpen, setIsBatchPrintOpen] = useState(false);
  const [isWeeklyPrintOpen, setIsWeeklyPrintOpen] = useState(false);

  const [isVitalsHistoryOpen, setIsVitalsHistoryOpen] = useState(false);
  const [isMedicationModalOpen, setIsMedicationModalOpen] = useState(false);

  const [scheduleDate, setScheduleDate] = useState<Date | null>(new Date());
  const todayKey = useVisitDay();
  const selectedDateKey = scheduleDate ? localDateKey(scheduleDate) : todayKey;
  const visits = useVisitSessions(todayKey, selectedDateKey, calendarMonth);
  const previousVisitDay = useRef(todayKey);
  useEffect(() => {
    const previous = previousVisitDay.current;
    previousVisitDay.current = todayKey;
    // Follow "today" across midnight, but never move a date while its form is open.
    if (previous !== todayKey && scheduleDate && localDateKey(scheduleDate) === previous && !isDetailModalOpen && !completingRecipient && !isModalOpen && !document.querySelector('[role="dialog"]')) {
      setScheduleDate(new Date());
    }
  }, [todayKey, scheduleDate, isDetailModalOpen, completingRecipient, isModalOpen]);
  const [isScheduleAddOpen, setIsScheduleAddOpen] = useState(false);
  const [managingScheduleRecipient, setManagingScheduleRecipient] = useState<Recipient | null>(null);

  const [activeTab, setActiveTab] = useState<'map' | 'list' | 'route' | 'settings'>('map');
  useEffect(() => {
    const retry = () => { if (document.visibilityState === 'visible') void retryPendingVisitLogs(); };
    void retry();
    window.addEventListener('online', retry);
    document.addEventListener('visibilitychange', retry);
    return () => { window.removeEventListener('online', retry); document.removeEventListener('visibilitychange', retry); };
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let disposed = false;
    let remove: (() => Promise<void>) | undefined;
    void import('@capacitor/app').then(async ({ App }) => {
      const listener = await App.addListener('backButton', () => {
        if (document.querySelector('[role="dialog"][data-state="open"]')) {
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
        } else if (activeTab !== 'map') setActiveTab('map');
        else void App.minimizeApp();
      });
      if (disposed) await listener.remove();
      else remove = () => listener.remove();
    });
    return () => { disposed = true; void remove?.(); };
  }, [activeTab]);
  const [listViewMode, setListViewMode] = useState<'list' | 'grid' | 'compact'>('list');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [isSplashVisible, setIsSplashVisible] = useState(true);

  // 로딩 화면이 너무 빨리 사라지는 것을 방지 (최소 1.5초 유지)
  useEffect(() => {
    if (dataLoaded) {
      const timer = setTimeout(() => setIsSplashVisible(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [dataLoaded]);
  const [mapZoom, setMapZoom] = useState(15);
  const isLocating = location.locating;
  const myLocation = location.position;
  useEffect(() => {
    if (!myLocation || !autoCenterLocation.current || selectedSido || selectedSigungu || selectedDong) return;
    const timer = window.setTimeout(() => {
      setMapCenter({ lat: myLocation.lat, lng: myLocation.lng });
      setMapZoom(16);
      if (myLocation.accuracy <= 100 && myLocation.source !== 'quick') autoCenterLocation.current = false;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [myLocation, selectedSido, selectedSigungu, selectedDong]);
  const [isOffline, setIsOffline] = useState(false);
  const [dataError, setDataError] = useState('');
  const [markerPhotoUrls, setMarkerPhotoUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const scope = captureAccountStorage();
    let active = true;
    const refresh = async () => {
      const photos = await Promise.all(markers.filter(marker => marker.photo_url).map(async marker => {
        try { return [marker.id, await resolveRecipientPhotoUrl(marker.photo_url)] as const; }
        catch { return [marker.id, null] as const; }
      }));
      if (active && scope.isCurrent()) setMarkerPhotoUrls(Object.fromEntries(photos.filter((photo): photo is readonly [string, string] => Boolean(photo[1]))));
    };
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, Math.max(30, PRIVATE_STORAGE_TTL_SECONDS - 45) * 1000);
    return () => { active = false; clearInterval(timer); };
  }, [markers]);

  // null이면 직선거리 기준 자동 추천을 따르고, 값이 있으면 사용자가 직접 고른 이동수단을 우선한다.

  // 새 출발/도착 쌍이 지정될 때마다 수동 선택을 초기화해 자동 추천으로 되돌린다.

  // 지도 탭에서 마커를 순서대로 탭하거나, 목록 탭에서 버튼을 눌러 출발/도착을 지정한다.
  // 같은 사람을 다시 탭하면 지정을 해제하고, 둘 다 이미 지정된 상태에서 새 사람을 탭하면
  // 그 사람을 새 출발로 삼아 처음부터 다시 지정한다.

  // 출발/도착이 모두 정해지면 직선거리로 이동수단을 추천하고,

  // 탐색을 이 앱 안에서 흉내내지 않고, 이미 잘 하는 시스템 지도 앱(네이버/카카오/티맵)의
  // 내비게이션으로 바로 넘긴다 — 직선거리만 참고용으로 보여준다.

  // 자동으로 다음 단계로 넘어간다. 마지막 단계를 지나면 도착으로 간주.

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
  }, [mapCenter, mapLoaded]);
  const [listFilter, setListFilter] = useState<'all' | 'today' | 'incomplete' | 'completed' | 'recurring' | 'missed' | 'cancelled'>('all');
  // 지도 상단 헤더 팝업들의 상호 배타적 단일 상태 (지역 선택 | 어르신 검색)
  // 하나의 상태로 관리하여 어떤 순서로 누르더라도 레이어가 겹치는 문제를 원천 차단합니다.
  const [activeHeaderModal, setActiveHeaderModal] = useState<'none' | 'region' | 'weather' | 'search'>('none');
  const isRegionFilterOpen = activeHeaderModal === 'region';

  const isWeatherDetailOpen = activeHeaderModal === 'weather';
  const isMapSearchOpen = activeHeaderModal === 'search';

  const toggleRegionFilter = () => {
    setActiveHeaderModal((prev) => (prev === 'region' ? 'none' : 'region'));
  };

  const toggleMapSearch = () => {
    setActiveHeaderModal((prev) => {
      if (prev === 'search') {
        setMapSearchQuery('');
        return 'none';
      }
      return 'search';
    });
  };

  const closeAllHeaderPopups = () => {
    setActiveHeaderModal('none');
    setMapSearchQuery('');
  };

  // 특정 어르신을 지도 중심으로 포커싱 & 지도 탭 활성화 & 마커/프리뷰 카드 연동
  const focusRecipientOnMap = (recipient: Recipient, zoom: number = 17) => {
    autoCenterLocation.current = false;
    recipient = markers.find(row => row.id === recipient.id) || recipient;
    if (!isValidCoordinates(recipient)) { setDataError('이 수급자의 위치를 확인하지 못했습니다. 명단에서 주소를 확인한 뒤 다시 불러와 주세요.'); return; }
    const lat = Number(recipient.lat);
    const lng = Number(recipient.lng);
    if (isNaN(lat) || isNaN(lng)) return;

    // React 상태 동기화
    setMapCenter({ lat, lng });
    setMapZoom(zoom);
    setActiveTab('map');
    setSelectedRecipient(recipient);
    setIsDetailModalOpen(false);
    closeAllHeaderPopups();

    // 네이버 지도 SDK 인스턴스 직접 조작
    if (mapRef.current && window.naver && window.naver.maps) {
      const targetLatLng = new window.naver.maps.LatLng(lat, lng);
      try {
        mapRef.current.morph(targetLatLng, zoom);
      } catch {
        try {
          mapRef.current.setCenter(targetLatLng);
          mapRef.current.setZoom(zoom);
        } catch {}
      }

      // 탭 전환 애니메이션 및 화면 리사이즈 대비 안전 타이머
      setTimeout(() => {
        if (mapRef.current && window.naver && window.naver.maps) {
          try {
            window.naver.maps.Event?.trigger(mapRef.current, 'resize');
            const targetLatLng = new window.naver.maps.LatLng(lat, lng);
            mapRef.current.setCenter(targetLatLng);
          } catch {}
        }
      }, 120);
    }
  };

  const [sortMode, setSortMode] = useState<'time' | 'name' | 'distance'>('name');
  const mapRef = useRef<any>(null);
  const isAutoSelectRef = useRef(false);

  // 경로(출발→도착) 전체 구간이 한 화면에 들어오도록 지도를 맞춘다.
  // "길찾기"로 외부 앱을 띄우는 대신, 이 지도 화면 안에서 바로 확인할 수 있게 하기 위함.

  // 경로선 위에 출발→도착 진행 방향을 보여줄 화살표 위치(일정 간격)

  // Programmatic Pan & Zoom (React State -> Map API)
  useEffect(() => {
    if (!mapRef.current || !window.naver?.maps) return;
    const map = mapRef.current;

    // 현재 지도의 실제 상태
    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();
    if (!currentCenter) return;

    // React State와 실제 지도 상태가 다를 때만 이동 (유저가 직접 드래그한 것을 되돌리지 않기 위해)
    const latDiff = Math.abs(currentCenter.y - mapCenter.lat);
    const lngDiff = Math.abs(currentCenter.x - mapCenter.lng);

    if (latDiff > 0.0001 || lngDiff > 0.0001) {
      const targetLatLng = new window.naver.maps.LatLng(mapCenter.lat, mapCenter.lng);
      try {
        map.panTo(targetLatLng);
      } catch {
        map.setCenter(targetLatLng);
      }
    }

    if (currentZoom !== mapZoom) {
      map.setZoom(mapZoom);
    }
  }, [mapCenter, mapZoom]);


  // 다 만들면 동/읍/면 기준 약 3,500개 생성으로 메인 스레드가 멈춘다)

  // 지도 이동/확대를 React 상태(mapZoom/mapCenter)와 항상 동기화하고, 켜져

  // 렌더링 상태 캐싱 (불필요한 중복 렌더 방지 및 토글 상태 변경 즉각 감지)

  useEffect(() => () => {
    for (const level of ['sido','sigungu','dong']) { labelCache[level].forEach((marker: any) => marker.setMap(null)); labelCache[level].clear(); renderedFeatureKeys[level].clear(); }
    currentRenderedLevel = '';
  }, []);

  // Semantic Zoom (시도 -> 시군구 -> 동): 어떤 레벨을 그릴지 결정하고 데이터를 로드

  useEffect(() => {
    if (!window.naver || !window.naver.maps || !window.naver.maps.Service) return;

    // 선택된 행정구역 이름 조합
    let query = '';
    const sidoName = sidos.find(s => s.code === selectedSido)?.fullName || '';
    const sigunguName = sigungus.find(s => s.code === selectedSigungu)?.fullName || '';
    const dongName = dongs.find(s => s.code === selectedDong)?.fullName || '';

    if (dongName) query = dongName;
    else if (sigunguName) query = sigunguName;
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
  }, [mapLoaded, selectedSido, selectedSigungu, selectedDong, sidos, sigungus, dongs]);

  // PWA Install State
  const INSTALL_DISMISSED_KEY = 'careroute_install_dismissed';
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true); // default true to hide initially
  // X로 한 번 닫으면 새로고침해도 계속 안 뜨게 유지 (단, 강제 새로고침
  // 버튼을 눌렀을 때는 이 값을 지워서 다시 뜨도록 함)
  const [installDismissed, setInstallDismissed] = useState(false);

  const waitingWorkerRef = useRef<ServiceWorker | null>(null);
  const updateReloadApproved = useRef(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);


  // 실시간 방문 알림 상태
  const [activeVisitAlert, setActiveVisitAlert] = useState<{ recipient: Recipient; timeStr: string } | null>(null);
  const notifiedKeysRef = useRef<Set<string>>(new Set());

  // Push 알림 자동 동기화: 이미 알림 권한이 허용된 경우 백그라운드 웹푸시 구독을 갱신/등록
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if ('Notification' in window && Notification.permission === 'granted') {
      registerPushSubscription().catch((err) => console.warn('Push 구독 자동 갱신 실패:', err));
    }
  }, []);

  // 포그라운드 방문 예정 시간 실시간 리마인더 (앱 사용 중 30초 간격 체크)
  useEffect(() => {
    const checkScheduledVisits = () => {
      if (!markers || markers.length === 0 || visits.loading || visits.error) return;
      const now = new Date();
      const currentHM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const ymd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      // 오늘 방문 예정 어르신 목록
      const scheduledToday = markers.filter((r) => getScheduledForDate(r, now) && (visits.sessions[sessionKey(r.id, ymd)]?.status || 'planned') === 'planned');

      for (const recipient of scheduledToday) {
        const parsedTime = parseVisitTime(recipient.visit_time, recipient.notes);
        if (!parsedTime.hasTime || !parsedTime.startTime) continue;
        const timePrefix = parsedTime.startTime;

        // 현재 분과 방문 시작 시간이 일치할 때 알림 발송
        if (timePrefix === currentHM) {
          const alertKey = `${recipient.id}_${ymd}_${currentHM}`;
          if (!notifiedKeysRef.current.has(alertKey)) {
            notifiedKeysRef.current.add(alertKey);

            // 1. 브라우저/OS 시스템 알림 발송 (데스크톱/노트북 및 모바일 완벽 지원)
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              const origin = window.location.origin;
              const notifTitle = '어르신 방문 예정 시간 알림 🚨';
              const notifOptions: NotificationOptions = {
                body: `${recipient.name} 어르신 방문 시간(${parsedTime.formattedText})입니다! (${recipient.address})`,
                icon: `${origin}/CareRoute/icon-192.png`,
                badge: `${origin}/CareRoute/icon-192.png`,
                tag: `visit-${recipient.id}-${ymd}`,
                data: { url: `${origin}/CareRoute/?focus=${recipient.id}`, recipientId: recipient.id },
              };

              let sentViaSW = false;
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then((reg) => {
                  reg.showNotification(notifTitle, notifOptions);
                  sentViaSW = true;
                }).catch(() => {});
              }

              // 노트북/데스크톱 브라우저에서 서비스워커가 아직 ready 상태가 아니거나 백그라운드 지연 시 표준 Notification으로 즉시 발송
              setTimeout(() => {
                if (!sentViaSW) {
                  try {
                    new Notification(notifTitle, notifOptions);
                  } catch (e) {
                    console.warn('Fallback Notification error:', e);
                  }
                }
              }, 200);
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
  }, [markers, visits.sessions, visits.loading, visits.error]);

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

    // 복귀 시 새 버전을 확인하며 적용은 사용자가 선택합니다.
    let disposed = false;
    let updateCheckId: ReturnType<typeof setInterval> | undefined;
    let removeControllerListener: (() => void) | undefined;
    const handleVisibilityResume = () => {
      if (document.visibilityState !== 'visible') return;


      registrationRef.current?.update().catch(() => {});
    };
    document.addEventListener('visibilitychange', handleVisibilityResume);

    // Installed bundles update through Google Play, not the web service worker.
    if (!Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
      const notifyUpdateAvailable = (worker: ServiceWorker) => {
        waitingWorkerRef.current = worker;
        window.dispatchEvent(new Event('careroute:web-update-ready'));
        // 앱이 백그라운드/다른 화면에 있어도 알아챌 수 있도록 시스템 알림도 함께 띄움
        if ('Notification' in window && Notification.permission === 'granted') {
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
        if (disposed) return;
        registrationRef.current = registration;
        // 접속 직후 바로 최신 버전 여부를 확인(브라우저의 기본 업데이트 체크 주기를 기다리지 않음)
        registration.update().catch(() => {});

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
        updateCheckId = setInterval(() => registration.update().catch(() => {}), 5 * 60 * 1000);
      }).catch(console.error);

      let refreshing = false;
      const controllerChanged = () => {
        if (updateReloadApproved.current && !refreshing) {
          refreshing = true;
          window.location.reload();
        } else {
          window.dispatchEvent(new Event('careroute:web-update-ready'));
        }
      };
      navigator.serviceWorker.addEventListener('controllerchange', controllerChanged);
      removeControllerListener = () => navigator.serviceWorker.removeEventListener('controllerchange', controllerChanged);
    }

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const handleMapError = () => { setMapError(true); setMapLoaded(false); };
    window.addEventListener('careroute:map-error', handleMapError);
    const handleMapReady = () => {
      if (window.naver?.maps?.Map && window.naver.maps.LatLngBounds) { setMapLoaded(true); setMapError(false); }
    };
    window.addEventListener('careroute:map-ready', handleMapReady);
    // Map loading check
    let attempts = 0;
    const checkMap = setInterval(() => {
      attempts++;
      if (window.naver?.maps?.jsContentLoaded && window.naver.maps.LatLngBounds && window.naver.maps.Map) {
        setMapLoaded(true);
        setMapError(false);
        clearInterval(checkMap);
      }
      if (attempts > 50) {
        setMapError(true);
        clearInterval(checkMap);
      }
    }, 500);

    return () => {
      disposed = true;
      clearInterval(updateCheckId);
      removeControllerListener?.();
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      document.removeEventListener('visibilitychange', handleVisibilityResume);
      clearInterval(checkMap);
      window.removeEventListener('careroute:map-error', handleMapError);
      window.removeEventListener('careroute:map-ready', handleMapReady);
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
    // 이 앱의 캐시만 비우고 사용자가 승인한 새 버전을 적용합니다.
    if ('caches' in window) {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.filter(key => key.startsWith('careroute-')).map((key) => caches.delete(key)));
      } catch {}
    }
    if (waitingWorkerRef.current?.state === 'installed') {
      updateReloadApproved.current = true;
      waitingWorkerRef.current.postMessage('SKIP_WAITING');
    }
    else window.location.reload();
  };

  useEffect(() => {
    const apply = (event: Event) => { event.preventDefault(); void handleUpdateRefresh(); };
    window.addEventListener('careroute:apply-web-update', apply);
    return () => window.removeEventListener('careroute:apply-web-update', apply);
  }, []);

const regionStyleFor = (lvl: string) => ({
    fillColor: showWeatherGridRef.current ? '#0ea5e9' : (lvl === 'dong' ? '#0ea5e9' : (lvl === 'sigungu' ? '#0d9488' : '#8b5cf6')),
    fillOpacity: showWeatherGridRef.current ? 0.08 : 0.1,
    strokeColor: showWeatherGridRef.current ? '#0284c7' : (lvl === 'dong' ? '#0ea5e9' : (lvl === 'sigungu' ? '#0d9488' : '#8b5cf6')),
    strokeWeight: showWeatherGridRef.current ? 1.5 : (lvl === 'dong' ? 1 : 2),
    strokeOpacity: showWeatherGridRef.current ? 0.7 : 0.6,
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

const handleRegionSelect = (lat: number, lng: number, lvl: string) => {
    const request = ++regionSelectionRequest.current;
    const scope = captureAccountStorage();
    autoCenterLocation.current = false;
    if (!window.naver?.maps?.Service) return;
    // @ts-ignore
    window.naver.maps.Service.reverseGeocode({
      coords: new window.naver.maps.LatLng(lat, lng),
      orders: [window.naver.maps.Service.OrderType.LEGAL_CODE].join(',')
    }, function (status: any, response: any) {
      if (request !== regionSelectionRequest.current || !scope.isCurrent()) return;
      if (status === 200 && response.v2.results.length > 0) {
        const bcode = response.v2.results[0].code.id; // 10자리 법정동 코드
        if (bcode && bcode.length === 10) {
          const sido = getProvinceCode(bcode);
          const result = response.v2.results[0];
          const districts = getDistricts(sido);
          const district = districts.find(row => row.code === bcode.substring(0, 5) + '00000')
            || districts.find(row => row.name === result.region?.area2?.name);
          const sigungu = district?.code || '';
          const neighborhood = getNeighborhoods(sigungu).find(row => row.code === bcode
            || row.name === result.region?.area3?.name);
          const dong = neighborhood?.code || '';
          if (lvl === 'sido') {
            setSelectedSido(sido);
            setSelectedSigungu('');
            setSelectedDong('');
          } else if (lvl === 'sigungu') {
            setSelectedSido(sido);
            setSelectedSigungu(sigungu);
            setSelectedDong('');
          } else {
            setSelectedSido(sido);
            setSelectedSigungu(sigungu);
            setSelectedDong(dong);
          }
        }
      }
    });
  };

const ensureRegionLabelMarker = (lvl: string, feature: any) => {
    const name = feature.properties.name;
    const isWeather = !!showWeatherGridRef.current;
    const baseKey = regionFeatureKey(feature);
    const cacheKey = isWeather ? `${baseKey}_weather` : baseKey;
    const cached = labelCache[lvl].get(cacheKey);
    const cachedWeather = weatherCache.get('L:' + getGridKey(feature.properties._centerLat, feature.properties._centerLng, 0.03));
    if (cached && (!isWeather || (cachedWeather && Date.now() - cachedWeather.timestamp < 20 * 60_000))) return cached;
    if (cached) cached.setMap(null);

    const centerLat = feature.properties._centerLat;
    const centerLng = feature.properties._centerLng;
    const fs = lvl === 'dong' ? '11px' : '12px';

    let marker: any;

    if (isWeather) {
      const renderWeatherContent = (emoji: string, tempText: string) => `
        <div class="marker-wrapper weather-region-pill" style="
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 8px;
          background: rgba(255, 255, 255, 0.95);
          color: #0f172a;
          border-radius: 9999px;
          font-size: ${fs};
          font-weight: 800;
          border: 1.5px solid #0284c7;
          box-shadow: 0 4px 14px rgba(2, 132, 199, 0.24);
          backdrop-filter: blur(8px);
          white-space: nowrap;
          cursor: pointer;
          user-select: none;
          transform: translate(-50%, -50%);
        ">
          <span style="font-weight: 900; color: #0284c7;">${escapeMarkerText(name)}</span>
          <span style="display: inline-flex; align-items: center; gap: 2px; font-weight: 800; color: #0f172a;">
            <span style="font-size: 13px;">${emoji}</span>
            <span>${tempText}</span>
          </span>
        </div>
      `;

      // 캐시된 기상 데이터가 있으면 즉시 반영
      const gridKey = 'L:' + getGridKey(centerLat, centerLng, 0.03);
      const weatherEntry = weatherCache.get(gridKey);
      const memWeather = weatherEntry && Date.now() - weatherEntry.timestamp < 20 * 60_000 ? weatherEntry.data : null;
      const initialEmoji = memWeather ? getWeatherEmojiAndDesc(memWeather.pty).emoji : '🌤️';
      const initialTemp = memWeather ? `${memWeather.temp}°` : '--°';

      marker = new window.naver.maps.Marker({
        position: new window.naver.maps.LatLng(centerLat, centerLng),
        icon: {
          content: renderWeatherContent(initialEmoji, initialTemp),
          anchor: new window.naver.maps.Point(0, 0),
        },
      });

      // 캐시가 없으면 비동기로 가져와서 갱신
      if (!memWeather) {
        fetchWeatherForCoord(centerLat, centerLng, 0.03, true).then((data) => {
          // 마커가 일시적으로 지도에서 내려가 있어도 아이콘은 갱신해야 다시 표시될 때 최신 값이 보인다
          if (data) {
            const { emoji } = getWeatherEmojiAndDesc(data.pty);
            marker.setIcon({
              content: renderWeatherContent(emoji, `${data.temp}°`),
              anchor: new window.naver.maps.Point(0, 0),
            });
          }
        });
      }

      // 클릭 시 해당 행정구역 중심으로 이동 및 날씨 상세 모달 표시
      window.naver.maps.Event.addListener(marker, 'click', () => {
        setMapCenter({ lat: centerLat, lng: centerLng });
        setActiveHeaderModal('weather');
      });
    } else {
      const bg = lvl === 'dong' ? 'var(--color-primary)' : (lvl === 'sigungu' ? 'var(--color-primary)' : 'var(--color-primary)');
      const normalFs = lvl === 'dong' ? '11px' : '13px';

      marker = new window.naver.maps.Marker({
        position: new window.naver.maps.LatLng(centerLat, centerLng),
        icon: {
          content: `<div class="marker-wrapper" style="padding: 2px 6px; background: ${bg}; color: white; border-radius: 8px; font-size: ${normalFs}; font-weight: bold; border: 1px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.15); white-space: nowrap; cursor: pointer;">${escapeMarkerText(name)}</div>`,
          anchor: new window.naver.maps.Point(20, 10),
        },
      });
      window.naver.maps.Event.addListener(marker, 'click', () => handleRegionSelect(centerLat, centerLng, lvl));
    }

    marker.__isWeather = isWeather;
    labelCache[lvl].set(cacheKey, marker);
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
      renderedFeatureKeys[lvl].add(regionFeatureKey(f));
      ensureRegionLabelMarker(lvl, f).setMap(map);
    });
  };







useEffect(() => {
    if (!mapRef.current || !window.naver) return;
    const map = mapRef.current;

    let active = true;
    const shouldShow = showRegions || showWeatherGrid;
    if (!shouldShow) {
      map.data.setStyle({ visible: false });
      ['sido', 'sigungu', 'dong'].forEach(lvl => {
        labelCache[lvl].forEach((m: any) => m.setMap(null));
      });
      currentRenderedLevel = '';
      lastRenderedKeyRef.current = '';
      return;
    }

    const level = mapZoom <= 10 ? 'sido' : (mapZoom <= 13 ? 'sigungu' : 'dong');
    const currentKey = `${level}_r:${showRegions}_w:${showWeatherGrid}_${mapCenter.lat}_${mapCenter.lng}`;

    // Optimization: 레벨과 표시 모드가 동일하면 재렌더하지 않음
    if (lastRenderedKeyRef.current === currentKey) return;
    lastRenderedKeyRef.current = currentKey;

    const urlMap: any = {
      sido: 'https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2013/json/skorea_provinces_geo_simple.json',
      sigungu: 'https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2013/json/skorea_municipalities_geo_simple.json',
      dong: 'https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2013/json/skorea_submunicipalities_geo_simple.json'
    };

    // 폴리곤 클릭 시: 기상 그리드 모드면 해당 구역 날씨 상세 열기, 아니면 행정구역 선택
    if (!window.naver.maps.Event.hasListener(map.data, 'click')) {
      window.naver.maps.Event.addListener(map.data, 'click', (e: any) => {
        const lat = e.feature.properties?._centerLat;
        const lng = e.feature.properties?._centerLng;
        if (!lat || !lng) return;
        if (showWeatherGridRef.current) {
          setMapCenter({ lat, lng });
          setActiveHeaderModal('weather');
        } else {
          handleRegionSelect(lat, lng, currentRenderedLevel);
        }
      });
    }

    if (geoCache[level]) {
      drawRegionLevel(map, level);
    } else {
      fetch(urlMap[level])
        .then(r => { if (!r.ok) throw new Error('행정구역 데이터를 불러오지 못했습니다.'); return r.json(); })
        .then(geojson => {
          if (!active) return;
          // 각 feature의 중심 좌표만 가볍게 미리 계산해둔다
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
          if (level === currentLevel && (showRegions || showWeatherGrid)) {
            drawRegionLevel(map, level);
          }
        }).catch(() => { if (!active) return; lastRenderedKeyRef.current = ''; setDataError('행정구역 데이터를 불러오지 못했습니다. 지도 레이어를 다시 켜주세요.'); });
    }
    return () => { active = false; };
  }, [mapZoom, mapCenter, mapLoaded, showRegions, showWeatherGrid]);

  const OFFLINE_CACHE_KEY = 'careroute_markers_cache_v1';

  const fetchMarkers = async () => {
    const scope = captureAccountStorage();
    if (!scope.isCurrent()) return;
    recipientRequest.current?.abort();
    const controller = new AbortController();
    recipientRequest.current = controller;
    const generation = ++recipientGeneration.current;
    const current = () => scope.isCurrent() && generation === recipientGeneration.current && !controller.signal.aborted;
    setRecipientsRefreshing(true);
    try {
      const rows = await loadRecipients(controller.signal);
      if (!current()) return;
      const hydrated = rows.map(row => {
        let coords = {};
        try {
          const cached = JSON.parse(scope.getItem(`careroute_geocode_v1_${row.id}`) || 'null');
          if (cached?.address === JSON.stringify([row.address || '', row.detail_address || '']) && Date.now() - cached.savedAt < 7 * 86400_000 && isValidCoordinates(cached)) coords = { lat: cached.lat, lng: cached.lng };
        } catch {}
        const memory = resolvedLocations.current.get(String(row.id));
        if (memory?.address === JSON.stringify([row.address || '', row.detail_address || '']) && isValidCoordinates(memory)) coords = { lat: memory.lat, lng: memory.lng };
        return { ...row, locationUnresolved: row.lat === 37.5665 && row.lng === 126.9780 && !isValidCoordinates(coords), ...coords, health_tags: row.health_tags || scope.getItem(`careroute_health_tags_${row.id}`) };
      }) as unknown as Recipient[];
      setMarkers(hydrated);
      setLocationRefreshVersion(value => value + 1);
      setDataError('');
      setIsOffline(false);
      try { scope.setItem(OFFLINE_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data: hydrated })); } catch {}
    } catch (cause) {
      if (!current()) return;
      const failure = cause instanceof RecipientLoadError ? cause : new RecipientLoadError('명단을 불러오지 못했습니다.', 0);
      if (failure.denied) {
        setMarkers([]);
        scope.removeItem(OFFLINE_CACHE_KEY);
        setIsOffline(false);
        setDataError('현재 계정의 데이터 접근 권한을 확인하지 못했습니다. 다시 로그인하거나 관리자에게 문의해 주세요.');
      } else if (failure.transient) {
        let cached = false;
        try {
          const stored = JSON.parse(scope.getItem(OFFLINE_CACHE_KEY) || 'null');
          if (Array.isArray(stored?.data) && stored.data.every((row: Recipient) => typeof row.id === 'string' && typeof row.name === 'string')) {
            setMarkers(previous => previous.length ? previous : stored.data.map((row: Recipient) => ({ ...row, locationUnresolved: row.locationUnresolved || (row.lat === 37.5665 && row.lng === 126.9780) })));
            cached = true;
          }
        } catch {}
        setIsOffline(cached);
        setDataError(cached ? '서버에 연결하지 못해 이 계정의 마지막 명단을 표시합니다. 최신 정보는 다시 불러와 주세요.' : '명단 연결이 지연되고 있습니다. 연결 상태를 확인하고 다시 불러와 주세요.');
      } else {
        setIsOffline(false);
        setDataError('명단을 불러오지 못했습니다. 서버 응답을 확인한 뒤 다시 시도해 주세요.');
      }
    } finally {
      if (current()) { setDataLoaded(true); setRecipientsRefreshing(false); }
    }
  };

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) void fetchMarkers(); });
    const refresh = () => { if (active && document.visibilityState === 'visible') void fetchMarkers(); };
    window.addEventListener('online', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      active = false;
      ++recipientGeneration.current;
      recipientRequest.current?.abort();
      window.removeEventListener('online', refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  const locationSignature = JSON.stringify(markers.map(row => [row.id, row.address, row.detail_address]));
  useEffect(() => {
    if (!mapLoaded || !window.naver?.maps?.Service) return;
    const scope = captureAccountStorage();
    const controller = new AbortController();
    // Search detailed/missing/default locations in the background; list loading never waits for Maps.
    const pending = markers.filter(row => row.address && (row.detail_address || !isValidCoordinates(row) || (row.lat === 37.5665 && row.lng === 126.9780)));
    let index = 0;
    const run = async () => {
      while (index < pending.length && !controller.signal.aborted && scope.isCurrent()) {
        const row = pending[index++];
        const address = JSON.stringify([row.address || '', row.detail_address || '']);
        try {
          const cached = JSON.parse(scope.getItem(`careroute_geocode_v1_${row.id}`) || 'null');
          const fresh = cached?.address === address && Date.now() - cached.savedAt < 7 * 86400_000 && isValidCoordinates(cached);
          const coords = fresh ? cached : await geocodeRecipientAddress(row.address, row.detail_address || undefined, controller.signal);
          if (!scope.isCurrent() || controller.signal.aborted) return;
          resolvedLocations.current.set(row.id, { address, lat: coords.lat, lng: coords.lng });
          try { if (!fresh) scope.setItem(`careroute_geocode_v1_${row.id}`, JSON.stringify({ ...coords, address, savedAt: Date.now() })); } catch { /* Cache quota must not discard the resolved position. */ }
          setMarkers(previous => previous.map(item => item.id === row.id && JSON.stringify([item.address || '', item.detail_address || '']) === address ? { ...item, lat: coords.lat, lng: coords.lng, locationUnresolved: false } : item));
          setSelectedRecipient(previous => previous?.id === row.id && JSON.stringify([previous.address || '', previous.detail_address || '']) === address ? { ...previous, lat: coords.lat, lng: coords.lng, locationUnresolved: false } : previous);
        } catch { /* Retain known coordinates; never replace an unresolved location with a made-up point. */ }
      }
    };
    void run(); void run();
    return () => controller.abort();
    // Coordinate changes do not restart the queue; address changes do.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded, locationSignature, locationRefreshVersion]);

  // 방문 알림을 눌렀을 때 해당 어르신 위치로 포커싱 (명단 클릭과 동일한 효과).
  // 현재 지역 필터에 안 걸릴 수도 있으니 필터를 해제하고 DB에서 직접 가져온다.
  const focusRecipientById = async (id: string) => {
    const { data, error } = await supabase.from('recipients').select('*').eq('id', id).single();
    if (error || !data) return;
    setSelectedSido('');
    setSelectedSigungu('');
    setSelectedDong('');
    focusRecipientOnMap(markers.find(row => row.id === data.id) || { ...data, locationUnresolved: data.lat === 37.5665 && data.lng === 126.9780 });
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

  const removeScheduleDate = async (r: Recipient, dateKey: string, version: number) => {
    const before = getVisit(r, dateKey);
    try {
      const saved = await saveVisitTransition(r, dateKey, 'cancelled', undefined, '일정 목록에서 제거', version);
      setRemovingActiveVisit(null);
      setRemovedSchedule({ recipient: r, dateKey, version: saved.version, status: before.status, memo: before.memo });
    } catch { /* The existing error banner explains the failure; keep the item. */ }
  };

  const handleRemoveFromSchedule = (r: Recipient, date: Date) => {
    const dateKey = localDateKey(date);
    const session = getVisit(r, dateKey);
    if (session.status === 'in_progress') {
      setRemovingActiveVisit({ recipient: r, dateKey, version: session.version });
      return;
    }
    void removeScheduleDate(r, dateKey, session.version);
  };

  const restoreScheduleDate = async (r: Recipient, dateKey: string, version: number, status: VisitStatus = 'planned', memo?: string | null) => {
    try {
      await saveVisitTransition(r, dateKey, status, memo, undefined, version);
      setRemovedSchedule(null);
    } catch { /* Keep the restore action available for retry. */ }
  };

  const handleDelete = async (id: string) => {
    const scope = captureAccountStorage();
    if (!window.confirm('해당 수급자 어르신을 정말 삭제하시겠습니까?')) return;
    try {
      const { error } = await supabase.from('recipients').delete().eq('id', id).select('id').single();
      if (error) throw error;
      if (!scope.isCurrent()) return;
      setMarkers(prev => {
        const next = prev.filter(m => m.id !== id);
        try { scope.setItem(OFFLINE_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data: next })); } catch {}
        return next;
      });
      if (selectedRecipient && selectedRecipient.id === id) {
        setSelectedRecipient(null);
      }
      setIsDetailModalOpen(false);
    } catch (e) {
      console.error(e);
      alert('삭제 중 오류가 발생했습니다.');
      fetchMarkers();
    }
  };

  const handleNavi = (type: 'system' | 'tmap' | 'kakao' | 'naver', lat: number, lng: number, address: string, detailAddress?: string | null) => {
    const recipient = markers.find(row => row.address === address && (row.detail_address || '') === (detailAddress || ''));
    if (!isValidCoordinates(recipient || { lat, lng })) { setDataError('이 주소의 위치를 확인하지 못해 길안내를 시작할 수 없습니다. 주소를 확인해 주세요.'); return; }
    if (recipient) { lat = recipient.lat; lng = recipient.lng; }

    // POI 검색 실패를 방지하기 위해 도착지 명칭을 고정
    const encName = encodeURIComponent('도착지');
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isMobile = isAndroid || isIOS;

    if (type === 'system') {
      if (isIOS) {
        window.location.href = `maps://?daddr=${lat},${lng}&dirflg=d`;
      } else if (isAndroid) {
        window.location.href = `geo:${lat},${lng}?q=${lat},${lng}(${encName})`;
      } else {
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
      }
      return;
    }

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
    const recipient = markers.find(row => row.address === address && (row.detail_address || '') === (detail || ''));
    if (!isValidCoordinates(recipient || { lat, lng })) { setDataError('이 주소의 위치를 확인하지 못해 길안내를 시작할 수 없습니다. 주소를 확인해 주세요.'); return; }
    if (recipient) { lat = recipient.lat; lng = recipient.lng; }

    let prefType: 'system' | 'tmap' | 'kakao' | 'naver' = 'system';
    if (typeof window !== 'undefined') {
      const saved = accountStorage.getItem('careroute_default_navi');
      if (saved === 'system' || saved === 'kakao' || saved === 'tmap' || saved === 'naver') {
        prefType = saved;
      }
    }
    handleNavi(prefType, lat, lng, address, detail);
  };

  const handleNearbySearch = (keyword: '약국' | '병원', lat: number, lng: number) => {
    let prefType = 'naver';
    if (typeof window !== 'undefined') {
      prefType = accountStorage.getItem('careroute_default_navi') || 'naver';
    }

    const encQuery = encodeURIComponent(keyword);

    if (prefType === 'kakao') {
      // 카카오맵 주변 검색: 키워드 검색 또는 위치 중심 검색
      window.open(`https://map.kakao.com/link/search/${encQuery}`, '_blank');
    } else if (prefType === 'tmap') {
      // 티맵 / 모바일 지도 검색
      window.open(`https://m.map.naver.com/search2/search.naver?query=${encQuery}&sm=sug&style=v5&x=${lng}&y=${lat}`, '_blank');
    } else {
      // 네이버 지도 주변 검색
      window.open(`https://m.map.naver.com/search2/search.naver?query=${encQuery}&sm=sug&style=v5&x=${lng}&y=${lat}`, '_blank');
    }
  };

  const getVisit = (r: Recipient, dateKey = todayKey): VisitSession => {
    const stored = visits.sessions[sessionKey(r.id, dateKey)];
    if (stored) return stored;
    const completed = r.last_completed_key === dateKey && dateKey <= todayKey;
    const started = dateKey === todayKey && r.last_visit_started_at && localDateKey(new Date(r.last_visit_started_at)) === dateKey;
    return { id: '', recipient_id: r.id, visit_date: dateKey, status: completed ? 'completed' : started ? 'in_progress' : 'planned',
      started_at: started ? r.last_visit_started_at! : null, completed_at: null,
      memo: completed ? r.last_completed_memo || null : null, version: 0, updated_at: '' };
  };
  const projectVisitForDate = (r: Recipient, dateKey: string): Recipient => {
    const session = getVisit(r, dateKey);
    return { ...r, last_completed_key: session.status === 'completed' ? dateKey : null,
      last_completed_memo: session.status === 'completed' ? session.memo : null };
  };
  const launchPrintRecipient = (r: Recipient, dateKey = detailDateKey) => {
    setPrintingDateKey(dateKey);
    setPrintingRecipient(projectVisitForDate(r, dateKey));
  };
  const openPrintRecipient = (r: Recipient, dateKey = detailDateKey) => { setPrintMenuTarget({ recipient: r, dateKey }); setIsPrintMenuOpen(true); };
  const openSchedulePrintMenu = () => { setPrintMenuTarget(null); setIsPrintMenuOpen(true); };
  const choosePrint = (kind: 'recipient' | 'day' | 'week') => {
    const scope = captureAccountStorage();
    const target = printMenuTarget;
    setIsPrintMenuOpen(false);
    window.setTimeout(() => {
      if (!scope.isCurrent()) return;
      if (kind === 'recipient' && target) launchPrintRecipient(target.recipient, target.dateKey);
      else if (kind === 'day') setIsBatchPrintOpen(true);
      else if (kind === 'week') setIsWeeklyPrintOpen(true);
    }, 200);
  };
  const visitActionIcon = (r: Recipient, dateKey = todayKey, size = 18) => {
    const status = getVisit(r, dateKey).status;
    if (status === 'completed') return <IconFileCheck size={size} strokeWidth={2.5} />;
    if (status === 'planned') return <IconPlayerPlay size={size} strokeWidth={2.5} />;
    if (status === 'in_progress') return <IconCheck size={size} strokeWidth={2.5} />;
    return <IconEye size={size} strokeWidth={2.5} />;
  };
  const isCompletedForDate = (r: Recipient, date: Date) => getVisit(r, localDateKey(date)).status === 'completed';
  const isCompletedToday = (r: Recipient) => getVisit(r).status === 'completed';
  const isVisitStartedToday = (r: Recipient) => getVisit(r).status === 'in_progress';
  const detailDateKey = activeTab === 'route' ? selectedDateKey : todayKey;
  const isSelectedVisitCompleted = (r: Recipient) => getVisit(r, detailDateKey).status === 'completed';

  const saveVisitTransition = async (r: Recipient, dateKey: string, status: VisitStatus, memo?: string | null, reason?: string, expectedVersion?: number) => {
    const scope = captureAccountStorage();
    if (!scope.isCurrent()) throw new Error('로그인 상태가 변경되었습니다. 다시 확인해주세요.');
    if (visitBusy.current || visits.loading || visits.error) {
      const message = visitBusy.current ? '다른 일정을 저장 중입니다. 잠시 기다려 주세요.' : '일정을 다시 불러온 뒤 저장해 주세요.';
      setVisitActionError(message);
      throw new Error(message);
    }
    visitBusy.current = true;
    setVisitSaving(true);
    setVisitActionError('');
    const savedMemo = memo === undefined ? getVisit(r, dateKey).memo : memo;
    const version = expectedVersion ?? getVisit(r, dateKey).version;
    const requestKey = JSON.stringify([r.id, dateKey, status, savedMemo || null, reason || null, version]);
    const requestId = visitRequestIds.current.get(requestKey) || crypto.randomUUID();
    visitRequestIds.current.set(requestKey, requestId);
    try {
      const saved = await transitionVisitSession({ recipientId: r.id, dateKey, status, memo: savedMemo, reason,
        expectedVersion: version, requestId });
      if (!scope.isCurrent()) throw new Error('로그인 상태가 변경되었습니다. 다시 확인해주세요.');
      visits.apply(saved);
      visitRequestIds.current.delete(requestKey);
      fetchMarkers();
      void visits.refresh();
      return saved;
    } catch (error) {
      const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : '일정 저장에 실패했습니다. 입력 내용은 유지됩니다.';
      setVisitActionError(message);
      void visits.refresh();
      throw new Error(message);
    } finally { visitBusy.current = false; setVisitSaving(false); }
  };
  const openScheduleManagement = (r: Recipient, dateKey = todayKey) => {
    setVisitActionError('');
    setScheduleDate(new Date(`${dateKey}T12:00:00`));
    setManagingScheduleRecipient(r);
  };
  const handleStartVisit = async (r: Recipient, dateKey = todayKey) => {
    try { await saveVisitTransition(r, dateKey, 'in_progress'); }
    catch (error) { setVisitActionError(error instanceof Error ? error.message : '방문 시작을 저장하지 못했습니다.'); }
  };
  const visitPrimaryLabel = (r: Recipient, dateKey = todayKey) => {
    const status = getVisit(r, dateKey).status;
    if (status === 'missed' || status === 'cancelled' || dateKey > todayKey || (status === 'planned' && dateKey !== todayKey)) return '';
    if (status === 'completed') return '완료 메모';
    return status === 'planned' ? '방문 시작' : '방문 완료';
  };
  const openCompletionForm = (r: Recipient, dateKey = todayKey) => {
    setVisitActionError('');
    if (dateKey > todayKey || ['missed', 'cancelled'].includes(getVisit(r, dateKey).status)) { openScheduleManagement(r, dateKey); return; }
    setCompletingDateKey(dateKey);
    setCompletingVersion(getVisit(r, dateKey).version);
    setCompletingRecipient(r);
  };
  const toggleCompleted = (r: Recipient, dateKey = todayKey) => {
    const status = getVisit(r, dateKey).status;
    if (!visitPrimaryLabel(r, dateKey)) return;
    if (status === 'planned') void handleStartVisit(r, dateKey);
    else if (status === 'in_progress' || status === 'completed') openCompletionForm(r, dateKey);
  };
  const finishVisit = async (memo: string, vitals?: VitalsInput) => {
    const scope = captureAccountStorage();
    if (!completingRecipient || !scope.isCurrent()) return;
    const target = completingRecipient;
    const dateKey = completingDateKey || todayKey;
    try {
      await saveVisitTransition(target, dateKey, 'completed', memo, undefined, completingVersion);
      if (!scope.isCurrent()) return;
      setCompletingRecipient(null);
      if (vitals) void logVitals({ recipientId: target.id, recipientName: target.name, vitals, memo });
    } catch { /* Keep the form open for retry. */ }
  };
  const handleSaveMemo = (memo: string, vitals?: VitalsInput) => finishVisit(memo, vitals);

  const getScheduledForDate = (r: Recipient, date: Date) => {
    const ymd = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    if (visits.sessions[sessionKey(r.id, ymd)]) return visits.sessions[sessionKey(r.id, ymd)].status !== 'cancelled';
    if (r.notes && r.notes.includes(ymd)) return true;
    if (r.recurring_weekdays) {
      return r.recurring_weekdays.split(',').map(Number).includes(date.getDay());
    }
    return false;
  };

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || visits.loading || visits.error) return;
    let chain = Promise.resolve();
    const refresh = () => {
      const items: { at: Date; recipientId: string }[] = [];
      const lead = Number(accountStorage.getItem('careroute_notif_lead_time') || '15');
      for (let offset = 0; offset < 7; offset++) {
        const day = new Date(); day.setDate(day.getDate() + offset);
        for (const row of markers) {
          if (!getScheduledForDate(row, day) || getVisit(row, localDateKey(day)).status !== 'planned') continue;
          const time = parseVisitTime(row.visit_time, row.notes).startTime;
          if (!/^\d{2}:\d{2}$/.test(time)) continue;
          const [hours, minutes] = time.split(':').map(Number);
          const at = new Date(day); at.setHours(hours, minutes, 0, 0);
          at.setMinutes(at.getMinutes() - (Number.isFinite(lead) ? lead : 15));
          items.push({ at, recipientId: row.id });
        }
      }
      chain = chain.then(() => scheduleVisitNotifications(items)).catch(error => console.warn('방문 알림 예약 실패', error));
    };
    refresh();
    window.addEventListener('careroute:notification-permission', refresh);
    const visible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', visible);
    return () => { window.removeEventListener('careroute:notification-permission', refresh); document.removeEventListener('visibilitychange', visible); };
  }, [markers, visits.sessions, visits.loading, visits.error]);


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
      const saved = accountStorage.getItem(`careroute_order_${scheduleDateKey}`);
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
        accountStorage.setItem(`careroute_order_${scheduleDateKey}`, JSON.stringify(newOrderIds));
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
        accountStorage.removeItem(`careroute_order_${scheduleDateKey}`);
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
    const todays = markers.filter(r => getVisit(r, localDateKey(scheduleDate)).status !== 'cancelled' && getScheduledForDate(r, scheduleDate));
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
  }, [markers, mapCenter, scheduleDate, scheduleDateKey, customOrderMap, visits.sessions]);

  // 이번 주 전체 출력용: 선택한 날짜가 포함된 일(일요일)~토요일 묶음을 날짜별로 미리 묶어둔다.
  // 경로 최적화까진 필요 없어(서류 준비용) 시간 있는 일정 먼저, 그 외는 이름순으로 가볍게 정렬.
  const weekDays = useMemo(() => {
    if (!scheduleDate) return [];
    const weekdayLabels = ['일', '월', '화', '수', '목', '금', '토'];
    const start = new Date(scheduleDate);
    start.setDate(start.getDate() - start.getDay());
    const days: { dateKey: string; dateLabel: string; recipients: Recipient[] }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dateLabel = `${d.getMonth() + 1}월 ${d.getDate()}일 (${weekdayLabels[d.getDay()]})`;
      const recipients = markers
        .filter((r) => getScheduledForDate(r, d))
        .sort((a, b) => {
          const ta = parseVisitTime(a.visit_time, a.notes);
          const tb = parseVisitTime(b.visit_time, b.notes);
          if (ta.hasTime && tb.hasTime) return ta.startTime.localeCompare(tb.startTime);
          if (ta.hasTime) return -1;
          if (tb.hasTime) return 1;
          return a.name.localeCompare(b.name);
        });
      days.push({ dateKey, dateLabel, recipients: recipients.map(r => projectVisitForDate(r, dateKey)) });
    }
    return days;
  }, [markers, scheduleDate, visits.sessions]);

  const weekLabel = weekDays.length === 7
    ? `${weekDays[0].dateKey.slice(5).replace('-', '.')}~${weekDays[6].dateKey.slice(5).replace('-', '.')}`
    : undefined;

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
    const scope = captureAccountStorage();
    if (!scope.isCurrent()) return;
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!Capacitor.isNativePlatform() && !clientId) {
      alert('Google Calendar 연동을 위한 클라이언트 ID 설정이 필요합니다. 관리자에게 문의해주세요.');
      return;
    }

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
      const nativeCalendar = Capacitor.isNativePlatform();
      if (!nativeCalendar) await loadGoogleScript();

      let accessToken = nativeCalendar ? (await CareRouteDevice.authorizeCalendar()).accessToken : scope.getItem('google_access_token');
      const expiresAt = scope.getItem('google_access_token_expires');

      if (!nativeCalendar && (!accessToken || !expiresAt || Date.now() > parseInt(expiresAt))) {
        accessToken = await new Promise<string>((resolve, reject) => {
          const tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: 'https://www.googleapis.com/auth/calendar.events',
            callback: (resp: any) => {
              if (resp.error) reject(new Error(resp.error));
              else {
                scope.setItem('google_access_token', resp.access_token);
                // expires_in is usually 3599 seconds. We subtract 60s for safety buffer.
                scope.setItem('google_access_token_expires', (Date.now() + (resp.expires_in - 60) * 1000).toString());
                resolve(resp.access_token);
              }
            },
          });
          // prompt: '' skips the consent screen if already authorized previously
          tokenClient.requestAccessToken({ prompt: '' });
        });
      }

      const ymd = `${(syncDate as Date).getFullYear()}-${String((syncDate as Date).getMonth() + 1).padStart(2, '0')}-${String((syncDate as Date).getDate()).padStart(2, '0')}`;
      if (!scope.isCurrent()) throw new Error('로그인 계정이 변경되어 캘린더 동기화를 중단했습니다.');
      const authHeaders = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

      // 이미 동기화한 이벤트가 있는지 확인합니다.
      const existingRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?privateExtendedProperty=${encodeURIComponent(`careRouteDate=${ymd}`)}`,
        { headers: authHeaders },
      );
      const existing = await existingRes.json();
      if (!existingRes.ok) throw new Error(existing.error?.message || `캘린더 조회 실패 (${existingRes.status})`);

      // 이미 일정이 존재할 경우 사용자에게 알림을 띄우고 처리 방식을 결정합니다.
      if (existing.items && existing.items.length > 0) {
        const wantsOverwrite = window.confirm('해당 날짜에 이미 동기화된 구글 캘린더 일정이 존재합니다.\n기존 일정을 삭제하고 최신 일정으로 덮어쓰시겠습니까?\n(취소를 누르면 중복으로 추가하지 않고 작업을 중단합니다.)');

        if (!wantsOverwrite) {
          setIsSyncingCalendar(false);
          return; // 사용자가 취소하면 중단 (중복 방지)
        }

      }

      const retainedEventIds = new Set<string>();
      for (const marker of targetRoute.filter(r => getVisit(r, localDateKey(syncDate as Date)).status !== 'cancelled')) {
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
            const endDate = new Date(`${startDateTime}+09:00`);
            endDate.setMinutes(endDate.getMinutes() + 30);
            endDateTime = endDate.toISOString();
          }
          body.start = { dateTime: startDateTime, timeZone: 'Asia/Seoul' };
          body.end = { dateTime: endDateTime, timeZone: 'Asia/Seoul' };
        } else {
          body.start = { date: ymd };
          const nextDay = new Date(`${ymd}T00:00:00Z`);
          nextDay.setUTCDate(nextDay.getUTCDate() + 1);
          body.end = { date: nextDay.toISOString().slice(0, 10) };
        }

        const previous = existing.items?.find((event: any) => event.extendedProperties?.private?.careRouteRecipientId === marker.id);
        if (previous) retainedEventIds.add(previous.id);
        const created = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events${previous ? `/${encodeURIComponent(previous.id)}` : ''}`, {
          method: previous ? 'PATCH' : 'POST',
          headers: authHeaders,
          body: JSON.stringify(body),
        });
        if (!created.ok) {
          const failure = await created.json().catch(() => ({}));
          throw new Error(failure.error?.message || `일정 등록 실패 (${created.status})`);
        }
      }

      // Remove obsolete events only after every replacement was saved successfully.
      for (const previous of existing.items || []) {
        if (retainedEventIds.has(previous.id)) continue;
        const removed = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(previous.id)}`, { method: 'DELETE', headers: authHeaders });
        if (!removed.ok) throw new Error(`이전 일정 정리 실패 (${removed.status}). 새 일정은 저장되었습니다.`);
      }

      alert(`${(syncDate as Date).getMonth()+1}월 ${(syncDate as Date).getDate()}일 방문 일정 ${targetRoute.length}건을 구글 캘린더에 동기화했습니다.`);
    } catch (err: any) {
      console.error(err);
      alert('구글 캘린더 동기화에 실패했습니다: ' + (err?.message || err));
    } finally {
      setIsSyncingCalendar(false);
    }
  };

  const normalizeListSearch = (value: string) => value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
  const listSearchTokens = normalizeListSearch(searchQuery).split(' ').filter(Boolean);
  const listFilterLabels = {
    all: '전체', today: '오늘 일정', incomplete: '오늘 예정·진행', completed: '오늘 방문 완료',
    recurring: '정기 일정', missed: '오늘 미방문 기록', cancelled: '오늘 방문 취소',
  };
  const hasListConditions = searchQuery.length > 0 || listFilter !== 'all' || sortMode !== 'name';
  const resetListConditions = () => {
    setSearchQuery('');
    setListFilter('all');
    setSortMode('name');
  };
  const matchesMapRegion = (marker: Recipient) => addressMatchesRegion(marker.address || '',
    dongs.find(row => row.code === selectedDong) || sigungus.find(row => row.code === selectedSigungu) || sidos.find(row => row.code === selectedSido), marker.dong);
  const regionMarkers = markers.filter(matchesMapRegion);
  const filteredMarkers = activeTab === 'list' ? markers.filter((marker) => {
    const fields = [marker.name, marker.address, marker.detail_address, marker.assigned_caregiver_name]
      .map(value => normalizeListSearch(value || ''));
    if (!listSearchTokens.every(token => fields.some(field => field.includes(token)))) return false;
    if (listFilter === 'today' && !getScheduledForDate(marker, new Date())) return false;
    if (listFilter === 'incomplete' && (!getScheduledForDate(marker, new Date()) || !['planned', 'in_progress'].includes(getVisit(marker).status))) return false;
    if (listFilter === 'completed' && (!getScheduledForDate(marker, new Date()) || !isCompletedToday(marker))) return false;
    if (listFilter === 'recurring' && !marker.recurring_weekdays) return false;
    if ((listFilter === 'missed' || listFilter === 'cancelled') && getVisit(marker).status !== listFilter) return false;
    return true;
  }).sort((a, b) => {
    if (sortMode === 'name') return a.name.localeCompare(b.name, 'ko');
    if (sortMode === 'distance') {
      return getDistanceFromLatLonInKm(mapCenter.lat, mapCenter.lng, a.lat, a.lng)
        - getDistanceFromLatLonInKm(mapCenter.lat, mapCenter.lng, b.lat, b.lng);
    }
    return (parseVisitTime(a.visit_time, a.notes).startTime || '99:99')
      .localeCompare(parseVisitTime(b.visit_time, b.notes).startTime || '99:99');
  }) : [];

  return (
    <main className="app-shell flex-1 flex flex-col h-[100dvh] relative bg-background font-sans">

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
              <div className="w-24 h-24 rounded-[32px] shadow-2xl flex items-center justify-center mb-6 relative overflow-hidden bg-white/10 backdrop-blur-md border border-white/20">
                <img
                  src="/CareRoute/icon-192.png"
                  alt="케어루트 로고"
                  className="w-full h-full object-cover rounded-[32px] drop-shadow-md"
                />
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

      {activeTab !== 'route' && (visits.error || (visitActionError && !completingRecipient)) && (
        <div role="alert" className="absolute top-[calc(1rem+var(--app-safe-top))] left-4 right-4 max-w-xl mx-auto z-[70] bg-surface border border-rose-500/40 rounded-2xl p-3 text-sm text-foreground shadow-lg">
          <p>{visits.error || visitActionError}</p>
          <button type="button" className="mt-2 underline font-bold" onClick={() => { setVisitActionError(''); void visits.refresh(); }}>다시 불러오기</button>
        </div>
      )}
      {/* 오프라인 안내: 서버 연결에 실패하면 마지막으로 저장해둔 명단을 대신
          보여주는데, 그게 최신 데이터가 아닐 수 있다는 걸 알려준다. */}
      {dataError && (
        <div role="alert" className="absolute top-[calc(4rem+var(--app-safe-top))] left-4 right-4 z-[60] rounded-2xl border border-red-500/30 bg-surface p-3 pr-14 text-sm text-foreground shadow-lg">
          <p>{dataError}</p>
          <IconButton aria-label="안내 닫기" onClick={() => setDataError('')} className="absolute right-2 top-2 min-h-11 min-w-11"><IconX size={18} /></IconButton>
          <button type="button" disabled={recipientsRefreshing} onClick={() => void fetchMarkers()} className="mt-2 min-h-11 rounded-xl border border-surface-border px-3 font-bold">다시 불러오기</button>
        </div>
      )}
      {isOffline && (
        <div className="absolute top-4 left-4 right-4 z-[60] bg-accent text-primary p-3 rounded-2xl shadow-xl flex items-center gap-2 animate-fade-in-down">
          <IconDownload size={18} className="flex-shrink-0" />
          <p className="text-sm font-bold">오프라인 상태입니다. 마지막으로 저장된 명단을 보여주고 있어요.</p>
        </div>
      )}

      {/* 앱 업데이트 안내창 */}

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

      {/* Top Floating NowBar Header - Modern iOS / Smart Island Style */}
      {activeTab === 'map' && (
      <header className="app-map-header absolute top-[var(--app-safe-top)] left-3.5 right-3.5 z-20 flex flex-col items-start gap-2 mt-2.5 pointer-events-none">
        {/* Dynamic NowBar Capsule */}
        <div id="tour-header" className="relative flex w-full items-center gap-2 pointer-events-auto">
          {/* Location Button */}
          <button
            onClick={toggleRegionFilter}
            aria-label="지역 선택"
            aria-expanded={isRegionFilterOpen}
            aria-controls="region-filter"
            className="h-16 sm:h-[72px] flex-1 min-w-0 bg-surface/90 supports-[backdrop-filter]:bg-surface/80 backdrop-blur-[36px] saturate-200 rounded-[28px] sm:rounded-[32px] px-4 shadow-[0_12px_36px_rgba(0,0,0,0.1)] border border-white/40 dark:border-white/10 flex items-center justify-between hover:bg-surface active:scale-[0.98] transition-all text-left"
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-[13px] bg-primary/10 flex items-center justify-center text-primary shadow-2xs">
                <IconMapPin size={19} strokeWidth={2.5} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-primary/70 block leading-none">탐색 위치</span>
                <span className="text-[15px] font-extrabold text-foreground truncate block leading-tight mt-1">
                  {(dongs.find(row => row.code === selectedDong) || sigungus.find(row => row.code === selectedSigungu) || sidos.find(row => row.code === selectedSido))?.fullName || (currentAddress === '위치 파악 중...' ? (myLocation ? '현재 위치 확인됨' : location.error ? '위치 권한·GPS 확인 필요' : '현재 위치 확인 중…') : currentAddress)}
                </span>
              </div>
            </div>
            <IconChevronDown size={18} className={`text-foreground/40 shrink-0 ml-1.5 transition-transform ${isRegionFilterOpen ? 'rotate-180 text-primary' : ''}`} />
          </button>

          {/* Map Search Toggle Button */}
          <button
            onClick={toggleMapSearch}
            className={`w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-[28px] sm:rounded-[32px] shadow-[0_12px_36px_rgba(0,0,0,0.1)] border border-white/40 dark:border-white/10 flex items-center justify-center shrink-0 active:scale-95 transition-all ${
              isMapSearchOpen ? 'bg-primary text-primary-foreground shadow-primary/30' : 'bg-surface/90 supports-[backdrop-filter]:bg-surface/80 text-foreground/80 hover:bg-surface'
            }`}
            title="지도에서 어르신 검색"
          >
            {isMapSearchOpen ? <IconX size={22} /> : <IconSearch size={22} strokeWidth={2.5} />}
          </button>
        </div>

        <WeatherWidget lat={mapCenter.lat} lng={mapCenter.lng} isOpen={isWeatherDetailOpen} onClose={closeAllHeaderPopups} modalOnly />
        {/* In-Map Search & Region Filter Common Backdrop */}
        {(isMapSearchOpen || isRegionFilterOpen) && (
          <div
            className="fixed inset-0 z-10 bg-black/10 backdrop-blur-[1px] pointer-events-auto"
            onClick={closeAllHeaderPopups}
          />
        )}

        {/* In-Map Search Bar Popup - Enlarged & Enhanced */}
        <AnimatePresence>
          {isMapSearchOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              className="app-map-popup relative z-20 w-full bg-surface/95 supports-[backdrop-filter]:bg-surface/85 backdrop-blur-[40px] saturate-200 rounded-[30px] p-4 sm:p-5 shadow-[0_22px_50px_rgba(0,0,0,0.18)] border border-white/40 dark:border-white/10 pointer-events-auto space-y-3"
            >
              <div className="relative">
                <input
                  type="text"
                  autoFocus
                  value={mapSearchQuery}
                  onChange={(e) => setMapSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const q = mapSearchQuery.trim().toLowerCase();
                      if (!q) return;
                      const matched = markers.find(m =>
                        (m.name && m.name.toLowerCase().includes(q)) ||
                        (m.address && m.address.toLowerCase().includes(q)) ||
                        (m.detail_address && m.detail_address.toLowerCase().includes(q)) ||
                        (m.assigned_caregiver_name && m.assigned_caregiver_name.toLowerCase().includes(q))
                      );
                      if (matched) {
                        focusRecipientOnMap(matched);
                      }
                    }
                  }}
                  placeholder="어르신 성함 또는 주소 검색 (예: 김순자, 역삼로...)"
                  className="w-full bg-foreground/[0.04] dark:bg-white/[0.06] rounded-[22px] py-3.5 pl-12 pr-11 text-[15px] sm:text-[16px] font-bold text-foreground placeholder:text-foreground/40 outline-none focus:ring-2 focus:ring-primary/40 transition-all shadow-inner-sm"
                />
                <IconSearch size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/40" />
                {mapSearchQuery && (
                  <button
                    onClick={() => setMapSearchQuery('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-foreground/10 hover:bg-foreground/20 flex items-center justify-center text-foreground/60 transition-colors"
                  >
                    <IconX size={13} strokeWidth={2.5} />
                  </button>
                )}
              </div>

              {/* Instant Search Results / Quick Elder Jump */}
              {mapSearchQuery.trim() === '' ? (
                <div className="pt-0.5">
                  <div className="flex items-center justify-between px-1 mb-2">
                    <span className="text-[12px] font-black text-foreground/50">
                      등록 어르신 ({markers.length}명)
                    </span>
                    <span className="text-[11px] font-bold text-primary">터치 시 지도 이동</span>
                  </div>
                  {markers.length > 0 ? (
                    <div className="space-y-1 max-h-56 overflow-y-auto pr-0.5">
                      {markers.slice(0, 4).map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => focusRecipientOnMap(m)}
                          className="w-full py-2.5 px-3 flex items-center justify-between text-left hover:bg-foreground/[0.04] active:bg-foreground/[0.08] rounded-2xl transition-colors cursor-pointer group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-[13px] bg-primary/10 text-primary flex items-center justify-center shrink-0 font-black text-sm shadow-2xs group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                              {m.name[0]}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[14px] font-black text-foreground truncate">{m.name} 어르신</p>
                              <p className="text-[11px] text-foreground/50 truncate mt-0.5">{m.address}{m.detail_address ? ` ${m.detail_address}` : ''}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-primary text-xs font-bold shrink-0 ml-2 opacity-70 group-hover:opacity-100">
                            <IconNavigation size={14} className="text-primary" />
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="py-4 text-center text-xs font-bold text-foreground/40">
                      등록된 수급자 어르신이 없습니다.
                    </div>
                  )}
                </div>
              ) : (() => {
                const q = mapSearchQuery.trim().toLowerCase();
                const matchedList = markers
                  .filter(m =>
                    (m.name && m.name.toLowerCase().includes(q)) ||
                    (m.address && m.address.toLowerCase().includes(q)) ||
                    (m.detail_address && m.detail_address.toLowerCase().includes(q)) ||
                    (m.assigned_caregiver_name && m.assigned_caregiver_name.toLowerCase().includes(q))
                  )
                  .slice(0, 8);

                return (
                  <div className="max-h-72 sm:max-h-80 overflow-y-auto divide-y divide-surface-border/40 pt-1">
                    {matchedList.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => focusRecipientOnMap(m)}
                        className="w-full py-3 px-3 flex items-center justify-between text-left hover:bg-foreground/[0.04] active:bg-foreground/[0.08] rounded-[20px] transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-[15px] bg-primary/10 text-primary flex items-center justify-center shrink-0 font-black text-sm shadow-2xs group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                            {m.name[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[15px] font-black text-foreground truncate">{m.name} 어르신</p>
                            <p className="text-[12px] font-medium text-foreground/60 truncate mt-0.5">{m.address}{m.detail_address ? ` ${m.detail_address}` : ''}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-black shrink-0 ml-2 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                          <span className="hidden sm:inline">위치 보기</span>
                          <IconNavigation size={14} className="text-primary" />
                        </div>
                      </button>
                    ))}
                    {matchedList.length === 0 && (
                      <div className="py-8 text-center text-foreground/40">
                        <IconSearch size={22} className="mx-auto mb-2 opacity-40" />
                        <p className="text-[13px] font-black text-foreground/60">일치하는 어르신이 없습니다.</p>
                        <p className="text-[11px] font-bold text-foreground/40 mt-0.5">성함이나 도로명/지번 주소를 다시 확인해 주세요.</p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Region Filter Dropdown - Inset Card */}
        {isRegionFilterOpen && (
        <div id="region-filter" className="app-map-popup relative z-20 mt-1 p-5 bg-surface/90 supports-[backdrop-filter]:bg-surface/75 backdrop-blur-[40px] saturate-200 rounded-[34px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-white/30 dark:border-white/10 pointer-events-auto animate-in fade-in slide-in-from-top-4 w-full max-w-[340px]">
          <div className="flex items-center justify-between pb-3.5 border-b border-surface-border/40 mb-4">
            <div>
              <span className="text-[17px] font-black text-foreground tracking-tight block">지역 직접 선택</span>
              <span className="text-[12px] font-bold text-foreground/50">원하는 행정구역으로 이동합니다</span>
            </div>
            <button
              onClick={closeAllHeaderPopups}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-foreground/5 text-foreground/50 hover:bg-foreground/10 transition-colors"
              aria-label="닫기"
            >
              <IconX size={18} />
            </button>
          </div>

          <div className="flex flex-col gap-3">
            <NativeSelect
              className="w-full !bg-foreground/[0.04] !border-0 !rounded-[20px] !py-3.5 !px-4 !text-[15px] !font-bold text-foreground focus:!ring-2 focus:!ring-primary/40 transition-all appearance-none"
              aria-label="시/도 선택"
              value={selectedSido}
              onChange={(e) => {
                autoCenterLocation.current = false;
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
              aria-label="시/군/구 선택"
              value={selectedSigungu}
              onChange={(e) => {
                autoCenterLocation.current = false;
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
              aria-label="읍/면/동 선택"
              value={selectedDong}
              onChange={(e) => { autoCenterLocation.current = false; setSelectedDong(e.target.value); }}
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
        {activeTab === 'map' && mapLoaded && (location.locating || location.error) && <div role="status" className="absolute left-4 right-20 bottom-[calc(6rem+var(--app-safe-bottom))] z-40 rounded-2xl border border-surface-border bg-surface p-3 text-sm leading-relaxed text-foreground shadow-lg">{location.error || '현재 위치 확인 중…'}{location.error && <button type="button" onClick={handleMyLocation} className="mt-2 min-h-11 font-bold text-primary">위치 다시 확인</button>}</div>}

        {/* Map View */}
        <div className={`absolute inset-0 top-0 transition-opacity duration-300 ${activeTab === 'map' ? 'z-0 opacity-100' : 'opacity-0 pointer-events-none'}`} style={{ zIndex: activeTab === 'map' ? 0 : -10 }}>
          <MapErrorBoundary>
          {mapLoaded ? (
            <Container id="react-naver-map" className="w-full h-full bg-surface-muted transition-all duration-500">
              <NaverMap
                ref={mapRef}
                onDragstart={() => { autoCenterLocation.current = false; }}
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
                                                {/* 내 위치 (파란 점). 걷는 중이라 GPS 진행 방향(heading)이 잡히면 화살표로 바꿔서 보여준다.
                    정지 상태면 heading이 null이라 일반 점으로 표시(없는 방향을 지어내지 않음). */}
                {myLocation && (
                  <Marker
                    position={{ lat: myLocation.lat, lng: myLocation.lng }}
                    zIndex={999}
                    icon={{
                      content: myLocation.heading != null ? `
                        <div class="relative flex items-center justify-center w-12 h-12 pointer-events-none" style="transform: rotate(${myLocation.heading}deg);">
                          <div class="absolute inset-0 bg-blue-500 rounded-full opacity-20"></div>
                          <div class="relative w-5 h-5 bg-blue-500 border-2 border-white rounded-full shadow-lg shadow-blue-500/50"></div>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2b7fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" style="position:absolute; top:-2px; filter: drop-shadow(0 1px 2px rgba(43,127,255,0.4));">
                            <path d="M7 11 L12 5 L17 11" />
                          </svg>
                        </div>
                      ` : `
                        <div class="relative flex items-center justify-center w-12 h-12 pointer-events-none">
                          <div class="absolute inset-0 bg-blue-500 rounded-full opacity-25 animate-ping"></div>
                          <div class="relative w-5 h-5 bg-blue-500 border-2 border-white rounded-full shadow-lg shadow-blue-500/50"></div>
                        </div>
                      `,
                      anchor: { x: 24, y: 24 }
                    }}
                  />
                )}
                {regionMarkers.filter(marker => isValidCoordinates(marker)).map((marker) => {
                  const isSelected = selectedRecipient?.id === marker.id;
                  const isCompleted = isCompletedToday(marker);
                                    return (
                    <Marker
                      key={marker.id}
                      position={{ lat: marker.lat, lng: marker.lng }}
                      onClick={() => {

                        autoCenterLocation.current = false;
                        setSelectedRecipient(marker);
                        setMapCenter({ lat: marker.lat, lng: marker.lng });
                      }}
                      icon={{
                        content: `
                          <div class="marker-wrapper relative flex flex-col items-center ${isSelected ? 'scale-115 z-50' : 'scale-100'} transition-transform duration-300">

                            <div class="relative w-11 h-11 flex items-center justify-center">
                              ${isSelected ? '<div class="absolute -inset-1.5 bg-accent rounded-full opacity-60 animate-ping"></div>' : ''}
                              <div class="relative w-11 h-11 rounded-full overflow-hidden ${isCompleted ? 'bg-emerald-600' : 'bg-primary'} flex items-center justify-center border-2 ${isSelected ? 'border-accent ring-2 ring-accent/50' : isCompleted ? 'border-emerald-400' : 'border-white'} shadow-md shadow-foreground/20 transition-colors duration-300">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                ${markerPhotoUrls[marker.id] ? `<img src="${escapeMarkerText(markerPhotoUrls[marker.id])}" onerror="this.style.display='none'" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" />` : ''}
                              </div>
                              ${isCompleted ? `
                                <div class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border border-white text-white flex items-center justify-center shadow-xs text-[10px] font-black">
                                  ✓
                                </div>
                              ` : ''}
                            </div>
                            <div class="mt-0.5 px-1.5 py-0.5 ${isSelected ? 'bg-accent text-primary font-black' : isCompleted ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700' : 'bg-surface text-primary'} text-[11px] font-bold rounded-md shadow-sm border border-surface-border whitespace-nowrap transition-colors duration-300 flex items-center gap-1">
                              ${isCompleted ? '<span class="text-emerald-600 dark:text-emerald-400 font-black">✓</span>' : ''}
                              <span>${escapeMarkerText(marker.name)}</span>
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
              <p className="font-extrabold text-xl text-foreground/70 mb-3 tracking-tight">{mapError ? '지도에 연결하지 못했습니다' : '지도를 불러오는 중입니다'}</p>
              <p className="text-[15px] leading-relaxed">{mapError ? '연결 상태 또는 지도 서비스 인증 설정을 확인해 주세요.' : '잠시만 기다려 주세요.'}<br/>수급자와 일정 메뉴는 계속 사용할 수 있습니다.</p>
              <p role="status" className="mt-3 text-sm text-foreground/70">{location.error || (isLocating ? '현재 위치 확인 중… 지도 연결과 별도로 위치를 찾고 있습니다.' : myLocation ? '현재 위치를 확인했습니다. 지도 연결 후 표시합니다.' : '')}</p>
              {mapError && <Button variant="plain" onClick={() => { setMapError(false); window.dispatchEvent(new Event('careroute:map-retry')); }} className="mt-4 min-h-11">지도 다시 연결</Button>}
            </div>
          )}
          </MapErrorBoundary>
        </div>
        {/* List View (Redesigned) */}
        {activeTab === 'list' && (
          <div className="app-scroll-view absolute inset-0 overflow-y-auto px-4 pt-16 pb-32 bg-background">

            {/* List View Header & Add Action */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-xl font-black text-foreground tracking-tight">
                  어르신 명단
                </h2>
                {markers.some(row => !isValidCoordinates(row)) && <p className="mt-1 text-sm leading-relaxed text-foreground/70">위치 미확인 {markers.filter(row => !isValidCoordinates(row)).length}명 · 주소를 확인해 주세요. 명단은 계속 사용할 수 있습니다.</p>}
                <button type="button" disabled={recipientsRefreshing} onClick={() => void fetchMarkers()} className="mt-1 min-h-11 text-sm font-bold text-primary disabled:opacity-50">{recipientsRefreshing ? '명단 불러오는 중…' : '명단 새로고침'}</button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditingRecipient(null);
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-1.5 min-h-11 shrink-0 px-3.5 py-2 rounded-full text-sm font-black bg-primary text-primary-foreground shadow-sm hover:opacity-95 active:scale-95 transition-all"
              >
                <IconUserPlus size={16} strokeWidth={2.5} />
                <span>어르신 등록</span>
              </button>
            </div>

            {/* Live Care Insight Metrics Bar */}
            <div className="grid grid-cols-2 min-[480px]:grid-cols-4 gap-2 mb-3.5">
              {[
                { key: 'all' as const, label: '전체', count: markers.length, color: 'text-primary', bg: 'bg-primary/10' },
                { key: 'today' as const, label: '오늘 일정', count: markers.filter(m => getScheduledForDate(m, new Date())).length, color: 'text-accent', bg: 'bg-accent/10' },
                { key: 'completed' as const, label: '오늘 완료', count: markers.filter(m => getScheduledForDate(m, new Date()) && isCompletedToday(m)).length, color: 'text-primary', bg: 'bg-primary/10' },
                { key: 'incomplete' as const, label: '오늘 예정·진행', count: markers.filter(m => getScheduledForDate(m, new Date()) && ['planned', 'in_progress'].includes(getVisit(m).status)).length, color: 'text-foreground', bg: 'bg-foreground/5' },
              ].map(stat => (
                <button
                  key={stat.key}
                  type="button"
                  onClick={() => setListFilter(stat.key)}
                  aria-pressed={listFilter === stat.key}
                  className={`p-2.5 rounded-[18px] transition-all text-left flex flex-col justify-between ${
                    listFilter === stat.key
                      ? `${stat.bg} ring-2 ring-primary shadow-xs`
                      : 'bg-surface/80 hover:bg-surface border border-surface-border/40'
                  }`}
                >
                  <span className="text-sm font-bold text-foreground/70 block leading-tight">{stat.label}</span>
                  <div className="flex items-baseline gap-0.5 mt-1">
                    <span className={`text-[17px] font-black tracking-tight ${stat.color}`}>{stat.count}</span>
                    <span className="text-sm font-bold text-foreground/70">명</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="mb-2">
              <label htmlFor="recipient-search" className="block text-sm font-bold text-foreground mb-1">어르신 검색</label>
              <div className="relative">
                <input
                  id="recipient-search"
                  type="search"
                  aria-label="어르신 검색"
                  aria-describedby="recipient-search-help"
                  placeholder="어르신 성함 또는 주소 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-surface border border-surface-border rounded-full min-h-11 py-2.5 pl-11 pr-12 text-base font-bold text-foreground placeholder:text-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 [&::-webkit-search-cancel-button]:appearance-none"
                />
                <IconSearch size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/60 pointer-events-none" />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery('')} className="absolute right-1 top-1/2 -translate-y-1/2 min-w-11 min-h-11 flex items-center justify-center text-foreground/70 rounded-full hover:bg-surface-muted" aria-label="검색어 지우기">
                    <IconX size={18} />
                  </button>
                )}
              </div>
              <p id="recipient-search-help" className="text-sm text-foreground/70 mt-1">이름·주소·담당 요양보호사로 검색</p>
            </div>

            {/* View Mode Segmented Pill & Sort Dropdown */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2 px-0.5">
              <div role="group" aria-label="어르신 보기 방식" className="flex bg-foreground/[0.04] dark:bg-white/[0.06] p-1 rounded-full border border-surface-border/40 shadow-2xs">
                <button
                  type="button"
                  aria-pressed={listViewMode === 'list'}
                  aria-label="목록 보기"
                  onClick={() => setListViewMode('list')}
                  className={`min-w-11 min-h-11 flex items-center justify-center rounded-full transition-all ${listViewMode === 'list' ? 'bg-surface text-primary shadow-xs font-black' : 'text-foreground/40 hover:text-foreground/70'}`}
                  title="목록 보기"
                >
                  <IconList size={18} />
                </button>
                <button
                  type="button"
                  aria-pressed={listViewMode === 'grid'}
                  aria-label="그리드 보기"
                  onClick={() => setListViewMode('grid')}
                  className={`min-w-11 min-h-11 flex items-center justify-center rounded-full transition-all ${listViewMode === 'grid' ? 'bg-surface text-primary shadow-xs font-black' : 'text-foreground/40 hover:text-foreground/70'}`}
                  title="그리드 보기"
                >
                  <IconLayoutGrid size={18} />
                </button>
                <button
                  type="button"
                  aria-pressed={listViewMode === 'compact'}
                  aria-label="심플 보기"
                  onClick={() => setListViewMode('compact')}
                  className={`min-w-11 min-h-11 flex items-center justify-center rounded-full transition-all ${listViewMode === 'compact' ? 'bg-surface text-primary shadow-xs font-black' : 'text-foreground/40 hover:text-foreground/70'}`}
                  title="심플 보기"
                >
                  <IconListDetails size={18} />
                </button>
              </div>

              <label className="flex items-center gap-1.5 min-w-0 max-w-full text-sm font-bold text-foreground/70">
                <span className="sr-only">정렬</span>
              <select
                aria-label="어르신 정렬"
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as typeof sortMode)}
                className="bg-surface/90 border border-white/30 dark:border-white/10 rounded-full min-h-11 min-w-0 max-w-full px-3 py-2 text-sm font-black text-foreground/80 focus:outline-none focus:ring-2 focus:ring-primary/30 shadow-xs cursor-pointer"
              >
                <option value="time">방문 시간순</option>
                <option value="name">어르신 이름순</option>
                <option value="distance">지도 중심 거리순</option>
              </select>
              </label>
            </div>

            {/* One UI 9.0 Filter Chips Carousel */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex flex-wrap gap-1.5 flex-1">
                {([
                  { key: 'recurring', label: '정기 일정' },
                  { key: 'missed', label: '미방문 기록' },
                  { key: 'cancelled', label: '방문 취소' },
                ] as const).map((f) => {
                  const count = markers.filter((m) => {
                    if (f.key === 'recurring') return Boolean(m.recurring_weekdays);
                    if (f.key === 'missed' || f.key === 'cancelled') return getVisit(m).status === f.key;
                    return true;
                  }).length;

                  return (
                    <button
                      key={f.key}
                      type="button"
                      aria-pressed={listFilter === f.key}
                      aria-label={`${f.label} ${count}`}
                      onClick={() => setListFilter(listFilter === f.key ? 'all' : f.key)}
                      className={`min-h-11 px-2 py-1.5 rounded-full text-sm font-black whitespace-nowrap transition-all active:scale-95 shadow-2xs flex items-center gap-1 shrink-0 ${
                        listFilter === f.key
                          ? 'bg-primary text-primary-foreground shadow-[0_6px_16px_rgba(var(--primary),0.3)] scale-[1.02]'
                          : 'bg-surface/80 text-foreground/60 border border-surface-border/60 hover:bg-surface'
                      }`}
                    >
                      <span>{f.label}</span>
                      <span className={`text-sm px-0.5 py-0.2 rounded-full font-black ${
                        listFilter === f.key ? 'bg-white/20 text-white' : 'bg-foreground/[0.06] text-foreground/60'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 mb-2">
              <div role="status" className="text-sm text-foreground/80">
                <p className="font-bold">검색 결과 {filteredMarkers.length}명 · 전체 {markers.length}명</p>
                <p>필터: {listFilterLabels[listFilter]} · 방문 상태는 오늘 기준</p>
              </div>
              {hasListConditions && (
                <button type="button" onClick={resetListConditions} className="min-h-11 px-3 text-sm font-bold text-primary rounded-full border border-surface-border hover:bg-surface-muted">조건 초기화</button>
              )}
            </div>

            {(markers.length === 0) ? (
              <div className="flex flex-col items-center justify-center h-full text-foreground/50 mt-16 p-8 bg-surface/60 rounded-[32px] border border-surface-border/40 text-center">
                <div className="w-20 h-20 bg-primary/5 rounded-[24px] flex items-center justify-center shadow-xs mb-4 text-primary">
                  <IconUser size={36} />
                </div>
                <p className="font-black text-lg text-foreground/80 mb-1">등록된 어르신이 없습니다.</p>
                <p className="text-sm text-foreground/50 mb-4">새로운 어르신을 등록하고 방문 경로를 관리해보세요.</p>
                <button
                  type="button"
                  onClick={() => {
                    setEditingRecipient(null);
                    setIsModalOpen(true);
                  }}
                  className="px-5 py-3 bg-primary text-primary-foreground font-black text-sm rounded-full shadow-md active:scale-95 transition-all flex items-center gap-2"
                >
                  <IconUserPlus size={18} strokeWidth={2.5} />
                  새 어르신 등록하기
                </button>
              </div>
            ) : (
              <div className={listViewMode === 'grid' ? "grid grid-cols-1 min-[480px]:grid-cols-2 gap-3.5" : "space-y-4"}>
                {(() => {
                  if (filteredMarkers.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center text-foreground/50 mt-12 bg-surface/80 rounded-[32px] py-12 px-6 shadow-xs border border-surface-border text-center">
                        <IconSearch size={44} className="text-foreground/20 mb-3" />
                        <p className="font-black text-lg text-foreground/70 mb-1">검색 조건에 맞는 어르신이 없습니다.</p>
                        <p className="text-sm text-foreground/40 mb-4">검색어나 필터 조건을 변경해보세요.</p>
                        <button
                          type="button"
                          onClick={resetListConditions}
                          className="min-h-11 px-4 py-2 bg-surface-muted hover:bg-surface-border text-foreground/70 font-bold text-sm rounded-full border border-surface-border transition-colors active:scale-95"
                        >
                          조건 초기화
                        </button>
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
                      setSelectedRecipient(marker);
                      setIsDetailModalOpen(true);
                    }}
                  >
                    {/* One UI 9.0 Inset List Card */}
                    {listViewMode === 'list' && (
                      <div className="p-5">
                        <div className="flex justify-between items-start mb-3.5">
                          <div className="flex-1 flex gap-3.5 items-start min-w-0">
                            <div className="w-14 h-14 bg-primary/5 rounded-[22px] flex items-center justify-center shrink-0 overflow-hidden border border-surface-border/40 shadow-2xs">
                              {marker.photo_url ? (
                                <PrivateImage src={marker.photo_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <IconUser size={28} className="text-primary" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <button type="button" aria-label={`${marker.name} 어르신 상세 보기`} onClick={(e) => { e.stopPropagation(); setSelectedRecipient(marker); setIsDetailModalOpen(true); }} className="text-left max-w-full text-[19px] font-black text-foreground tracking-tight min-h-11 whitespace-normal [overflow-wrap:anywhere]">{marker.name} 어르신</button>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-sm font-black bg-accent/15 text-accent border border-accent/20">
                                  <IconClock size={12} strokeWidth={2.5} />
                                  {(() => {
                                    const parsed = parseVisitTime(marker.visit_time, marker.notes);
                                    return parsed.hasTime ? `${parsed.formattedText} 방문` : '시간 미정';
                                  })()}
                                </span>
                                {getVisit(marker).status !== 'planned' && (
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-sm font-black border ${getVisit(marker).status === 'completed' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20' : 'bg-surface-muted text-foreground/80 border-surface-border'}`}>
                                    {getVisit(marker).status === 'completed' && <IconCheck size={12} strokeWidth={3} />}
                                    {VISIT_STATUS_LABEL[getVisit(marker).status]}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-1 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
{Boolean(visitPrimaryLabel(marker)) && (<IconButton
                              onClick={(e) => { e.stopPropagation(); toggleCompleted(marker); }}
                              disabled={visitSaving || visits.loading}
                              className={`min-w-11 min-h-11 rounded-[18px] transition-all ${
                                isCompletedToday(marker)
                                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                                  : 'bg-surface-muted text-foreground/50 hover:bg-surface-border'
                              }`}
                              aria-label={visitPrimaryLabel(marker)}
                            >
                              {visitActionIcon(marker, todayKey, 18)}
                            </IconButton>)}
                            {/* 경로 출발/도착 지정: 누르면 지도 탭의 경로 그리기 모드가 켜지고 순서대로 출발→도착이 지정된다 */}

                          </div>
                        </div>

                        {/* Address & Door Passcode Box */}
                        <div className="bg-foreground/[0.03] dark:bg-white/[0.04] rounded-[22px] p-3.5 mb-3.5 space-y-2 border border-surface-border/30">
                          <div className="flex gap-2.5 items-center">
                            <IconMapPin size={18} className="text-primary/70 shrink-0" />
                            <p className="font-bold text-foreground/80 leading-relaxed text-sm [overflow-wrap:anywhere]">
                              {marker.address}{marker.detail_address ? ` ${marker.detail_address}` : ''}
                            </p>
                          </div>
                          {(marker.door_passcode || marker.parking_memo) && (
                            <div className="flex items-center gap-2 pt-1 border-t border-surface-border/20 text-sm flex-wrap">
                              {marker.door_passcode && (
                                <span className="inline-flex max-w-full items-start gap-1 font-black [overflow-wrap:anywhere] text-foreground/80 bg-surface-muted px-2.5 py-0.5 rounded-full">
                                  <IconKey size={12} strokeWidth={2.5} /> 비번 {marker.door_passcode}
                                </span>
                              )}
                              {marker.parking_memo && (
                                <span className="inline-flex max-w-full items-start gap-1 font-black [overflow-wrap:anywhere] text-foreground/80 bg-surface-muted px-2.5 py-0.5 rounded-full">
                                  <IconCar size={12} /> {marker.parking_memo}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Card Action Buttons: 4 Quick Actions */}
                        <div className="grid grid-cols-2 min-[480px]:grid-cols-4 gap-2">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDirections(marker.lat, marker.lng, marker.address, marker.detail_address); }}
                            className="min-h-11 py-2.5 rounded-[16px] bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-sm font-black flex items-center justify-center gap-1 active:scale-95 transition-all shadow-xs"
                          >
                            <IconNavigation size={15} />
                            <span>길안내</span>
                          </button>
<button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); openScheduleManagement(marker); }}
                            className="min-h-11 py-2.5 rounded-[16px] bg-primary/10 hover:bg-primary/15 text-primary text-sm font-black flex items-center justify-center gap-1 active:scale-95 transition-all border border-primary/20"
                          >
                            <IconMessageCircle size={15} />
                            <span>일정 관리</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              focusRecipientOnMap(marker);
                            }}
                            className="min-h-11 py-2.5 rounded-[16px] bg-foreground/[0.04] dark:bg-white/[0.06] hover:bg-foreground/[0.08] text-foreground text-sm font-black flex items-center justify-center gap-1 active:scale-95 transition-all border border-surface-border/40"
                          >
                            <IconMapPin size={15} />
                            <span>지도 보기</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setEditingRecipient(marker); setIsModalOpen(true); }}
                            className="min-h-11 py-2.5 rounded-[16px] bg-foreground/[0.04] dark:bg-white/[0.06] hover:bg-foreground/[0.08] text-foreground/70 text-sm font-black flex items-center justify-center gap-1 active:scale-95 transition-all"
                          >
                            <IconPencil size={15} />
                            <span>수정</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* One UI 9.0 Inset Grid Card */}
                    {listViewMode === 'grid' && (
                      <div className="p-4 flex flex-col h-full">
                        <div className="flex justify-between items-start mb-3">
                          <div className="w-12 h-12 bg-primary/5 rounded-[18px] flex items-center justify-center overflow-hidden border border-surface-border/40 shadow-2xs shrink-0">
                            {marker.photo_url ? (
                              <PrivateImage src={marker.photo_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <IconUser size={24} className="text-primary" />
                            )}
                          </div>
{Boolean(visitPrimaryLabel(marker)) && (<button
                            onClick={(e) => { e.stopPropagation(); toggleCompleted(marker); }}
                              disabled={visitSaving || visits.loading}
                            className={`min-w-11 min-h-11 flex items-center justify-center rounded-[14px] transition-colors ${
                              isCompletedToday(marker) ? 'bg-emerald-500 text-white shadow-sm' : 'bg-surface-muted text-foreground/40 hover:bg-surface-border'
                            }`}
                            aria-label={visitPrimaryLabel(marker)}
                          >
                            {visitActionIcon(marker, todayKey, 16)}
                          </button>)}
                        </div>
                        <button type="button" aria-label={`${marker.name} 어르신 상세 보기`} onClick={(e) => { e.stopPropagation(); setSelectedRecipient(marker); setIsDetailModalOpen(true); }} className="text-left max-w-full text-[17px] font-black text-foreground tracking-tight min-h-11 whitespace-normal [overflow-wrap:anywhere]">{marker.name} 어르신</button>
                        <p className="text-sm font-bold text-accent mb-2 [overflow-wrap:anywhere]">
                          {parseVisitTime(marker.visit_time, marker.notes).formattedText}
                        </p>
                        <p className="text-sm text-foreground/60 font-semibold [overflow-wrap:anywhere] mb-4 flex-1 leading-relaxed">
                          {marker.address}{marker.detail_address ? ` ${marker.detail_address}` : ''}
                        </p>
                        <Button
                          variant="dark"
                          onClick={(e) => { e.stopPropagation(); handleDirections(marker.lat, marker.lng, marker.address, marker.detail_address); }}
                          className="min-h-11 py-2.5 text-sm w-full mt-auto rounded-[16px]"
                        >
                          길안내
                        </Button>
                        <Button variant="ghost" onClick={(e) => { e.stopPropagation(); openScheduleManagement(marker); }} className="min-h-11 mt-2 text-sm w-full rounded-[16px]">일정 관리</Button>
                      </div>
                    )}

                    {/* One UI 9.0 Inset Compact Card */}
                    {listViewMode === 'compact' && (
                      <div className="p-3.5 flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/5 rounded-[16px] flex items-center justify-center shrink-0 overflow-hidden border border-surface-border/30">
                          {marker.photo_url ? (
                            <PrivateImage src={marker.photo_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <IconUser size={20} className="text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <button type="button" aria-label={`${marker.name} 어르신 상세 보기`} onClick={(e) => { e.stopPropagation(); setSelectedRecipient(marker); setIsDetailModalOpen(true); }} className="text-left max-w-full font-black text-[15px] text-foreground tracking-tight min-h-11 whitespace-normal [overflow-wrap:anywhere]">{marker.name}</button>
                            {isCompletedToday(marker) && (
                              <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                                <IconCheck size={10} strokeWidth={3} />
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-foreground/70 font-bold leading-relaxed [overflow-wrap:anywhere]">
                            {parseVisitTime(marker.visit_time, marker.notes).formattedText} · {marker.address}{marker.detail_address ? ` ${marker.detail_address}` : ''}
                          </p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDirections(marker.lat, marker.lng, marker.address, marker.detail_address); }}
                          type="button"
                          className="min-w-11 min-h-11 flex items-center justify-center p-2.5 bg-surface-muted/80 text-foreground/70 rounded-[14px] hover:bg-surface-border transition-colors shrink-0 active:scale-95"
                          aria-label="길안내"
                        >
                          <IconNavigation size={18} />
                        </button>
                        <IconButton onClick={(e) => { e.stopPropagation(); openScheduleManagement(marker); }} aria-label="일정 관리" className="min-w-11 min-h-11 shrink-0 rounded-[14px] bg-surface-muted/80 text-foreground/70">
                          <IconCalendarEvent size={18} />
                        </IconButton>
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
          <div className="app-scroll-view absolute inset-0 overflow-y-auto px-4 pt-16 pb-32 bg-background flex flex-col">
            {(visits.error || (visitActionError && !completingRecipient)) && <div role="alert" className="mb-3 shrink-0 rounded-2xl border border-rose-500/40 bg-surface p-3 text-sm text-foreground">
              <p className="break-words">{visits.error || visitActionError}</p>
              <button type="button" className="mt-2 min-h-11 rounded-xl px-3 underline font-bold" onClick={() => { setVisitActionError(''); void visits.refresh(); }}>다시 불러오기</button>
            </div>}
            {removedSchedule && <div role="status" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-surface-border bg-surface p-3 text-sm text-foreground">
              <p className="min-w-0 flex-1 break-words">{removedSchedule.recipient.name} · {removedSchedule.dateKey} 일정을 제거했습니다.</p>
              <Button variant="ghost" disabled={visitSaving || visits.loading || Boolean(visits.error)} onClick={() => void restoreScheduleDate(removedSchedule.recipient, removedSchedule.dateKey, removedSchedule.version, removedSchedule.status, removedSchedule.memo)} className="min-h-11">되돌리기</Button>
              <IconButton aria-label="일정 제거 알림 닫기" onClick={() => setRemovedSchedule(null)}><IconX size={18} /></IconButton>
            </div>}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              {scheduleDate && (
                <div>
                  <p className="text-xl font-black text-foreground tracking-tight">
                    {scheduleDate.toDateString() === new Date().toDateString() ? '오늘의 ' : `${scheduleDate.getMonth() + 1}월 ${scheduleDate.getDate()}일 `}
                    방문 일정
                  </p>
                  <p className="text-sm text-foreground/60 font-semibold">
                    방문 일정 {scheduleRoute.length}건 · 제거한 일정 {markers.filter(r => visits.sessions[sessionKey(r.id, selectedDateKey)]?.status === 'cancelled').length}건
                  </p>
                </div>
              )}

              {scheduleDate && <Button onClick={() => setIsScheduleAddOpen(true)} startIcon={<IconPlus size={18} />} className="min-h-11 shrink-0 text-sm px-3">일정 추가</Button>}

              {/* 순서 편집 및 최적화 리셋 버튼 */}
              {scheduleDate && scheduleRoute.length > 1 && (
                <div className="flex w-full flex-wrap items-center gap-1.5">
                  {scheduleDateKey && customOrderMap[scheduleDateKey] && (
                    <button
                      type="button"
                      onClick={resetToOptimizedOrder}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-black bg-surface-muted text-foreground/80 hover:bg-surface-border transition-colors shadow-2xs active:scale-95 border border-surface-border/40"
                      title="방문 시간과 직선거리 기준 추천 순서로 복구"
                    >
                      <IconRotate2 size={13} />
                      추천 순서
                    </button>
                  )}
                  <span className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-black bg-primary/10 text-primary border border-primary/20">
                    <IconArrowsSort size={13} />
                    순서 조정 가능
                  </span>
                </div>
              )}
            </div>

            {/* 폭염/한파 주의 수준 안내: 오늘 방문 예정 없는 어르신 안부를 챙기도록 유도 */}

            {/* 그날/이번 주 방문 일정을 한 번에 인쇄/PDF로 출력 (현장 나가기 전 서류 준비용) */}
            {scheduleDate && <Button variant="ghost" onClick={openSchedulePrintMenu} startIcon={<IconPrinter size={18} />} className="mb-3 min-h-11 self-start">출력</Button>}

            {/* Quick Date Switcher & Progress Insight */}
            <div className="bg-surface/85 supports-[backdrop-filter]:bg-surface/65 backdrop-blur-[36px] rounded-[22px] p-3 mb-3 border border-white/30 dark:border-white/10 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {[
                    { label: '어제', offset: -1 },
                    { label: '오늘', offset: 0 },
                    { label: '내일', offset: 1 },
                  ].map(btn => (
                    <button
                      key={btn.label}
                      type="button"
                      onClick={() => {
                        const target = new Date();
                        target.setDate(target.getDate() + btn.offset);
                        setScheduleDate(target);
                      }}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-black transition-all active:scale-95 ${
                        scheduleDate && scheduleDate.toDateString() === new Date(Date.now() + btn.offset * 86400000).toDateString()
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'bg-foreground/[0.04] text-foreground/60 hover:text-foreground'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>

                <span className="text-[12px] font-black text-foreground/75">
                  {scheduleDate ? new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }).format(scheduleDate) : ''}
                </span>
              </div>

              {/* Progress metric */}
              {scheduleRoute.length > 0 && (() => {
                const completedCount = scheduleRoute.filter(r => isCompletedForDate(r, scheduleDate as Date)).length;
                const targetCount = scheduleRoute.filter(r => getVisit(r, selectedDateKey).status !== 'cancelled').length;
                const percent = targetCount ? Math.round((completedCount / targetCount) * 100) : 0;
                return (
                  <div className="space-y-1 pt-1 border-t border-surface-border/30">
                    <div className="flex flex-wrap gap-1 justify-between text-[11px] font-bold text-foreground/60">
                      <span>방문 달성 현황</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-black">{targetCount ? `${completedCount} / ${targetCount}곳 완료 (${percent}%)` : '방문 대상 없음'} · 취소 제외</span>
                    </div>
                    <div className="w-full h-2 bg-foreground/[0.06] dark:bg-white/[0.06] rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Month Grid Calendar */}
            <MonthCalendar
              collapsible={false}
              onMonthChange={(date) => setCalendarMonth(localDateKey(date))}
              getDaySummary={(date) => { const rows = markers.filter(r => getScheduledForDate(r, date)); return { count: rows.length, names: rows.map(r => r.name), pending: visits.loading || Boolean(visits.error) || visits.loadedMonth !== localDateKey(date).slice(0, 7) }; }}
              selectedDate={scheduleDate}
              onSelectDate={setScheduleDate}
              hasSchedule={(d) => markers.some(r => getScheduledForDate(r, d))}
            />

            {scheduleDate && (showRemovedSchedules || markers.some(r => visits.sessions[sessionKey(r.id, selectedDateKey)]?.status === 'cancelled')) && <section className="mb-3 rounded-2xl border border-surface-border bg-surface p-3 text-foreground">
              <button type="button" aria-expanded={showRemovedSchedules} aria-controls="removed-schedules" onClick={() => setShowRemovedSchedules(value => !value)} className="min-h-11 w-full text-left text-sm font-bold">제거한 일정 {markers.filter(r => visits.sessions[sessionKey(r.id, selectedDateKey)]?.status === 'cancelled').length}건 {showRemovedSchedules ? '접기' : '보기'}</button>
              {showRemovedSchedules && <div id="removed-schedules" className="space-y-2">
                <p className="text-sm leading-relaxed text-foreground/60">선택한 날짜에서만 제거됩니다. 반복 요일과 방문 기록은 유지됩니다.</p>
                {markers.filter(r => visits.sessions[sessionKey(r.id, selectedDateKey)]?.status === 'cancelled').map(r => <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-surface-border pt-2"><span className="min-w-0 flex-1 break-words text-sm font-bold">{r.name}</span><Button variant="ghost" disabled={visitSaving || visits.loading || Boolean(visits.error)} onClick={() => void restoreScheduleDate(r, selectedDateKey, getVisit(r, selectedDateKey).version)} className="min-h-11">일정 복원</Button></div>)}
                {!markers.some(r => visits.sessions[sessionKey(r.id, selectedDateKey)]?.status === 'cancelled') && <p className="py-2 text-sm text-foreground/60">제거한 일정이 없습니다.</p>}
              </div>}
            </section>}

            {scheduleDate && (
              scheduleRoute.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-foreground/50 mt-12 pb-16 animate-fade-in-up text-center">
                  <div className="w-20 h-20 bg-surface rounded-full flex items-center justify-center shadow-sm mb-4">
                    <IconCalendarEvent size={32} className="text-slate-300" />
                  </div>
                  <p className="font-bold text-lg text-foreground/60 mb-1">일정이 없습니다.</p>
                  <p className="text-sm text-foreground/40 mb-4">선택하신 날짜에 방문할 어르신을 추가해보세요.</p>
                  <button
                    type="button"
                    onClick={() => setIsScheduleAddOpen(true)}
                    className="px-5 py-2.5 bg-primary text-primary-foreground font-black text-sm rounded-full shadow-md active:scale-95 transition-all flex items-center gap-1.5"
                  >
                    <IconPlus size={18} strokeWidth={2.5} />
                    일정에 어르신 추가
                  </button>
                </div>
              ) : (
              <div className="relative pl-6 space-y-4 mt-4">
                {/* Vertical Timeline Gradient Connector Line */}
                <div className="absolute top-4 bottom-8 left-[11px] w-[3px] bg-gradient-to-b from-primary via-accent to-surface-border rounded-full" />

                {scheduleRoute.map((marker, i) => {
                  const completed = isCompletedForDate(marker, scheduleDate);
                  const isNext = ['planned', 'in_progress'].includes(getVisit(marker, selectedDateKey).status) && scheduleRoute.slice(0, i).every(r => ['completed', 'missed', 'cancelled'].includes(getVisit(r, selectedDateKey).status));

                  return (
                    <motion.div
                      key={marker.id}
                      layout
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => setSelectedRecipient(marker)}
                      className="relative flex gap-3.5 items-start cursor-pointer transition-all"
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
                          <div className="hidden min-[360px]:flex w-13 h-13 rounded-[20px] bg-primary/5 items-center justify-center shrink-0 overflow-hidden border border-surface-border/40 shadow-2xs">
                            {marker.photo_url ? (
                              <PrivateImage src={marker.photo_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <IconUser size={26} className="text-primary" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0 pt-0.5">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <button type="button" aria-label={`${marker.name} 어르신 상세 보기`} onClick={(e) => { e.stopPropagation(); setSelectedRecipient(marker); setIsDetailModalOpen(true); }} className={`text-left w-full min-h-11 font-black text-[18px] text-foreground tracking-tight [overflow-wrap:anywhere] `} >{marker.name} 어르신</button>
                              <span className="text-xs whitespace-nowrap font-bold text-foreground/65">{VISIT_STATUS_LABEL[getVisit(marker, selectedDateKey).status]}</span>
                              {isNext && (
                                <span className="whitespace-nowrap px-2.5 py-0.5 bg-accent text-accent-foreground text-[10px] font-black rounded-full animate-pulse shadow-xs">
                                  다음 방문
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

                            {/* 공동현관 비번 / 주차메모 배지 */}
                            {(marker.door_passcode || marker.parking_memo) && (
                              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                {marker.door_passcode && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 font-black text-[11px] border border-amber-500/20 shadow-2xs">
                                    <IconKey size={13} strokeWidth={2.5} />
                                    <span>비번: {marker.door_passcode}</span>
                                  </span>
                                )}
                                {marker.parking_memo && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-400 font-bold text-[11px] border border-sky-500/20">
                                    <IconCar size={13} />
                                    <span className="max-w-[130px] truncate">{marker.parking_memo}</span>
                                  </span>
                                )}
                              </div>
                            )}
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
                                className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${
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
                                className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${
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

                        <div className="mt-4 space-y-3 border-t border-surface-border pt-3" onClick={(e) => e.stopPropagation()}>
                          <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-2">
{Boolean(visitPrimaryLabel(marker, selectedDateKey)) && (<Button
                              onClick={() => toggleCompleted(marker, selectedDateKey)}
                              disabled={visitSaving || visits.loading || Boolean(visits.error)}
                              startIcon={visitActionIcon(marker, selectedDateKey)}
                              className={`min-h-11 whitespace-normal text-sm px-3 ${getVisit(marker, selectedDateKey).status === 'missed' ? 'min-[360px]:col-span-2' : ''}`}
                              variant={completed ? 'plain' : 'primary'}
                            >
                              <span aria-label={`${marker.name} ${visitPrimaryLabel(marker, selectedDateKey)}`}>{visitPrimaryLabel(marker, selectedDateKey)}</span>
                            </Button>)}
                            {['planned', 'in_progress'].includes(getVisit(marker, selectedDateKey).status) && <Button variant="ghost" onClick={() => handleDirections(marker.lat, marker.lng, marker.address, marker.detail_address)} startIcon={<IconNavigation size={18} />} className="min-h-11 whitespace-normal text-sm px-3">길안내</Button>}

                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button variant="ghost" onClick={() => openPrintRecipient(marker, selectedDateKey)} startIcon={<IconPrinter size={16} />} className="min-h-11 flex-1 whitespace-normal text-sm px-3">출력</Button>
                            <Button variant="ghost" onClick={() => openScheduleManagement(marker, selectedDateKey)} startIcon={<IconPencil size={16} />} className="min-h-11 flex-1 whitespace-normal text-sm px-3">일정 수정</Button>
                            {getVisit(marker, selectedDateKey).status !== 'cancelled' && <Button variant="danger-ghost" onClick={() => handleRemoveFromSchedule(marker, scheduleDate)} disabled={visitSaving || visits.loading || Boolean(visits.error)} startIcon={<IconTrash size={16} />} className="min-h-11 flex-1 whitespace-normal text-sm px-3"><span aria-label={`${marker.name} 일정 제거`}>일정 제거</span></Button>}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ))}

          </div>
        )}
      </div>

      {activeTab === 'settings' && (
        <SettingsView
          accountEmail={accountEmail}
          onSignOut={onSignOut}
          onSyncCalendar={handleSyncToCalendar}
          isSyncingCalendar={isSyncingCalendar}
          onReplayTutorial={() => {
            setActiveTab('map');
            setTimeout(() => setShowOnboarding(true), 100);
          }}
          onBack={() => setActiveTab('map')}
          totalRecipientsCount={markers.length}
          todayTotalCount={markers.filter(m => getScheduledForDate(m, new Date())).length}
          todayCompletedCount={markers.filter(m => getScheduledForDate(m, new Date()) && isCompletedToday(m)).length}
          onNavigateTab={(tab) => setActiveTab(tab)}
          recipients={markers}
          onOpenAddRecipient={() => {
            setEditingRecipient(null);
            setIsModalOpen(true);
          }}
          onDataRestored={fetchMarkers}
        />
      )}

      {/* 맵 플로팅 컨트롤 툴바 (줌 / 레이어 / 내위치) - One UI 9.0 Squircle Island */}
      {activeTab === 'map' && (
        <div id="tour-map-controls" className={`absolute right-4 ${selectedRecipient && !isDetailModalOpen ? 'bottom-[calc(230px+var(--app-safe-bottom))]' : 'bottom-[calc(104px+var(--app-safe-bottom))]'} transition-all duration-300 z-40 flex flex-col items-center gap-3.5 pointer-events-none`}>

          <div className="flex flex-col items-center bg-surface/85 supports-[backdrop-filter]:bg-surface/70 backdrop-blur-[40px] saturate-200 rounded-[28px] shadow-[0_16px_40px_rgba(0,0,0,0.12)] border border-white/30 dark:border-white/10 pointer-events-auto p-1.5 gap-1.5">
            {/* 지도 레이어 (행정구역 경계 + 기상 그리드) 통합 메뉴 */}
            <div className="relative">

              <AnimatePresence>

              </AnimatePresence>
            </div>

            <div className="w-7 h-[1px] bg-foreground/10" />

            <div className="relative">
              <motion.button
                type="button"
                whileTap={{ scale: 0.90 }}
                onClick={() => setIsLayerMenuOpen(prev => !prev)}
                className={`w-11 h-11 flex items-center justify-center rounded-[20px] transition-colors ${(showRegions || showWeatherGrid) ? 'bg-primary text-primary-foreground shadow-md' : 'hover:bg-foreground/[0.04] text-foreground/80'}`}
                aria-label="지도 레이어" title="지도 레이어"
              >
                <IconMap size={22} strokeWidth={2.5} />
              </motion.button>

              <AnimatePresence>
                {isLayerMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsLayerMenuOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, x: 8 }}
                      animate={{ opacity: 1, scale: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95, x: 8 }}
                      transition={{ type: 'spring', damping: 28, stiffness: 400 }}
                      className="map-layer-menu absolute right-[56px] top-1/2 -translate-y-1/2 z-20 bg-surface/95 supports-[backdrop-filter]:bg-surface/85 backdrop-blur-[40px] saturate-200 rounded-[22px] p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.14)] border border-white/30 dark:border-white/10 w-[196px] pointer-events-auto"
                    >
                      <button
                        type="button"
                        onClick={() => setShowRegions(v => !v)}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-[16px] hover:bg-foreground/[0.05] transition-colors"
                      >
                        <span className="flex items-center gap-2 text-[13px] font-bold text-foreground/80">
                          <IconMap size={16} /> 행정구역 경계
                        </span>
                        <span className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${showRegions ? 'bg-primary' : 'bg-foreground/15'}`}>
                          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${showRegions ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </span>
                      </button>
                      <button type="button" onClick={() => { setIsLayerMenuOpen(false); setActiveHeaderModal('weather'); }} className="w-full min-h-11 px-3 py-2.5 rounded-[16px] text-left text-sm font-bold text-foreground hover:bg-foreground/[0.05]">현재 지도 위치 날씨</button>
                      <button
                        type="button"
                        onClick={() => setShowWeatherGrid(v => !v)}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-[16px] hover:bg-foreground/[0.05] transition-colors"
                      >
                        <span className="flex items-center gap-2 text-[13px] font-bold text-foreground/80">
                          <IconCloud size={16} /> 기상 그리드
                        </span>
                        <span className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${showWeatherGrid ? 'bg-sky-500' : 'bg-foreground/15'}`}>
                          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${showWeatherGrid ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </span>
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <div className="w-7 h-[1px] bg-foreground/10" />

            {/* 내 위치 */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.90 }}
              onClick={handleMyLocation}
              disabled={isLocating}
              className={`w-11 h-11 flex items-center justify-center rounded-[20px] transition-colors disabled:opacity-60 ${myLocation ? 'text-primary bg-primary/10' : 'text-foreground/80 hover:bg-foreground/[0.04]'}`}
              aria-label="내 위치로 이동"
              title="내 위치로 이동"
            >
              {isLocating ? (
                <Spinner size={18} className="text-primary" />
              ) : (
                <IconCurrentLocation size={22} strokeWidth={2.5} />
              )}
            </motion.button>
          </div>

          {/* 두 어르신 경로 그리기 모드 (보조 FAB, 평소엔 뷰 컨트롤과 분리) */}

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

      {/* 지도 하단 어르신 퀵 프리뷰 플로팅 카드 (Senior Floating Peek Card) */}
      <AnimatePresence>
        {activeTab === 'map' && selectedRecipient && !isDetailModalOpen && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.96 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="app-recipient-preview app-map-card fixed bottom-[88px] left-3 right-3 sm:left-6 sm:right-6 max-w-lg mx-auto z-40 bg-surface/90 supports-[backdrop-filter]:bg-surface/80 backdrop-blur-[40px] saturate-200 rounded-[30px] p-4 border border-white/30 dark:border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.18)]"
          >
            <div className="flex items-start gap-3.5">
              {/* Squircle Profile Avatar */}
              <div className="relative w-14 h-14 rounded-[22px] overflow-hidden bg-primary/10 flex items-center justify-center shrink-0 border border-surface-border/60 shadow-xs">
                {selectedRecipient.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <PrivateImage src={selectedRecipient.photo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <IconUser size={30} className="text-primary" />
                )}
                {isSelectedVisitCompleted(selectedRecipient) && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs text-[11px] font-black border-2 border-surface">
                    ✓
                  </div>
                )}
              </div>

              {/* Info Column */}
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-[17px] font-black text-foreground tracking-tight truncate">
                    {selectedRecipient.name} 어르신
                  </h3>
                  {isSelectedVisitCompleted(selectedRecipient) ? (
                    <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-black text-[10px] rounded-full">
                      방문완료
                    </span>
                  ) : isVisitStartedToday(selectedRecipient) ? (
                    <span className="px-2 py-0.5 bg-amber-500/15 text-amber-600 dark:text-amber-400 font-black text-[10px] rounded-full">
                      진행 중 · {Math.max(0, Math.floor((Date.now() - new Date(getVisit(selectedRecipient, detailDateKey).started_at as string).getTime()) / 60000))}분
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-primary/10 text-primary font-black text-[10px] rounded-full">
                      {parseVisitTime(selectedRecipient.visit_time, selectedRecipient.notes).formattedText}
                    </span>
                  )}
                  {getVisit(selectedRecipient, detailDateKey).status === 'planned' && detailDateKey === todayKey && (
                    <button
                      type="button"
                      onClick={() => handleStartVisit(selectedRecipient)}
                      disabled={visitSaving || visits.loading}
                      className="px-2 py-0.5 bg-foreground/[0.06] hover:bg-foreground/[0.1] text-foreground/60 font-black text-[10px] rounded-full active:scale-95 transition-all shrink-0"
                    >
                      방문 시작
                    </button>
                  )}
                </div>

                <p className="text-xs text-foreground/60 font-semibold truncate leading-relaxed">
                  {selectedRecipient.address}{selectedRecipient.detail_address ? ` ${selectedRecipient.detail_address}` : ''}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {selectedRecipient.assigned_caregiver_name && (
                    <p className="text-xs text-foreground/50 font-semibold truncate leading-relaxed">
                      담당 {selectedRecipient.assigned_caregiver_name}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsVitalsHistoryOpen(true)}
                    className="flex items-center gap-1 text-[11px] font-black text-primary active:opacity-60 transition-opacity shrink-0"
                  >
                    <IconActivity size={12} strokeWidth={2.5} />
                    활력징후
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsMedicationModalOpen(true)}
                    className="flex items-center gap-1 text-[11px] font-black text-primary active:opacity-60 transition-opacity shrink-0"
                  >
                    <IconPill size={12} strokeWidth={2.5} />
                    복약
                  </button>
                </div>

                {/* Badges: Health Tags & Passcode & Parking */}
                {(() => {
                  const activeTags = selectedRecipient.health_tags ||
                    (typeof window !== 'undefined' ? accountStorage.getItem(`careroute_health_tags_${selectedRecipient.id}`) : null);
                  return (selectedRecipient.door_passcode || selectedRecipient.parking_memo || selectedRecipient.guardian_phone || activeTags) ? (
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {activeTags && activeTags.split(',').filter(Boolean).slice(0, 2).map((tag, idx) => (
                        <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 font-black text-[10px] border border-red-500/20 shadow-2xs">
                          #{tag.trim()}
                        </span>
                      ))}
                      {selectedRecipient.guardian_phone && (
                        <a
                          href={`tel:${selectedRecipient.guardian_phone}`}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-black text-[10px] border border-emerald-500/20 shadow-2xs"
                        >
                          <IconPhone size={11} strokeWidth={2.5} />
                          <span>보호자{selectedRecipient.guardian_relation ? `(${selectedRecipient.guardian_relation})` : ''} {selectedRecipient.guardian_phone}</span>
                        </a>
                      )}
                      {selectedRecipient.door_passcode && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 font-black text-[10px] border border-amber-500/20 shadow-2xs">
                          <IconKey size={11} strokeWidth={2.5} />
                          <span>비번: {selectedRecipient.door_passcode}</span>
                        </span>
                      )}
                      {selectedRecipient.parking_memo && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-400 font-bold text-[10px] border border-sky-500/20">
                          <IconCar size={11} />
                          <span className="max-w-[120px] truncate">{selectedRecipient.parking_memo}</span>
                        </span>
                      )}
                    </div>
                  ) : null;
                })()}
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setSelectedRecipient(null)}
                className="w-8 h-8 rounded-full bg-foreground/[0.05] hover:bg-foreground/[0.1] text-foreground/60 flex items-center justify-center transition-colors shrink-0 -mr-1 -mt-1 active:scale-95"
                aria-label="닫기"
              >
                <IconX size={16} strokeWidth={2.5} />
              </button>
            </div>

            {/* Quick Action Buttons */}
            <div className="grid grid-cols-4 gap-2 mt-3.5 pt-3 border-t border-surface-border/40">
              <button
                type="button"
                onClick={() => handleDirections(selectedRecipient.lat, selectedRecipient.lng, selectedRecipient.address, selectedRecipient.detail_address)}
                className="py-2.5 rounded-[16px] bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-[12px] font-black flex items-center justify-center gap-1 active:scale-95 transition-all shadow-xs"
              >
                <IconNavigation size={15} />
                <span>길안내</span>
              </button>

{Boolean(visitPrimaryLabel(selectedRecipient, detailDateKey)) && (<button
                type="button"
                onClick={() => toggleCompleted(selectedRecipient, detailDateKey)}
                    disabled={visitSaving || visits.loading}
                className={`py-2.5 rounded-[16px] text-[12px] font-black flex items-center justify-center gap-1 active:scale-95 transition-all border ${
                  isSelectedVisitCompleted(selectedRecipient)
                    ? 'bg-surface-muted text-foreground/60 hover:bg-surface-border border-surface-border/40'
                    : 'bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 border-emerald-500/25'
                }`}
              >
                <IconCheck size={15} strokeWidth={2.5} />
                <span>{visitPrimaryLabel(selectedRecipient, detailDateKey)}</span>
              </button>)}

<button
                type="button"
                onClick={() => openScheduleManagement(selectedRecipient, detailDateKey)}
                className="py-2.5 rounded-[16px] bg-primary/10 hover:bg-primary/20 text-primary text-[12px] font-black flex items-center justify-center gap-1 active:scale-95 transition-all border border-primary/20"
              >
                <IconMessageCircle size={15} />
                <span>일정 관리</span>
              </button>

              <button
                type="button"
                onClick={() => setIsDetailModalOpen(true)}
                className="py-2.5 rounded-[16px] bg-foreground/[0.04] dark:bg-white/[0.06] hover:bg-foreground/[0.08] text-foreground text-[12px] font-black flex items-center justify-center gap-1 active:scale-95 transition-all border border-surface-border/40"
              >
                <IconEye size={15} />
                <span>상세정보</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 어르신 상세 팝업 - One UI 9.0 Hero Bottom Sheet / Dialog */}
      <Modal
        open={Boolean(selectedRecipient && (activeTab === 'route' || isDetailModalOpen))}
        onClose={() => {
          setSelectedRecipient(null);
          setIsDetailModalOpen(false);
        }}
      >
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
                onClick={() => {
                  setSelectedRecipient(null);
                  setIsDetailModalOpen(false);
                }}
                className="w-9 h-9 rounded-full bg-black/25 text-white hover:bg-black/40 backdrop-blur-md"
                aria-label="닫기"
              >
                <IconX size={18} strokeWidth={2.5} />
              </IconButton>

              {/* Squircle Avatar Profile Photo */}
              <div className="absolute left-6 -bottom-10 w-22 h-22 rounded-[24px] bg-surface border-4 border-surface shadow-xl overflow-hidden flex items-center justify-center">
                {selectedRecipient.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <PrivateImage src={selectedRecipient.photo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <IconUser size={38} className="text-primary" />
                )}
              </div>
            </div>

            <div className="px-6 pb-6 pt-12">
              {/* Senior Title & Health Tags */}
              <div className="flex flex-col min-[400px]:flex-row items-start justify-between gap-3 mb-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-2xl font-black text-foreground tracking-tight">
                      {selectedRecipient.name} 어르신
                    </p>
                    {isSelectedVisitCompleted(selectedRecipient) && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-500/15 text-emerald-600 border border-emerald-500/20">
                        방문 완료 ✓
                      </span>
                    )}
                  </div>

                  {(() => {
                    const activeTags = selectedRecipient.health_tags ||
                      (typeof window !== 'undefined' ? accountStorage.getItem(`careroute_health_tags_${selectedRecipient.id}`) : null);
                    if (!activeTags) return null;
                    return (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {activeTags.split(',').filter(Boolean).map((tag, idx) => (
                          <span key={idx} className="px-2.5 py-0.5 bg-red-500/10 text-red-600 rounded-full text-xs font-black border border-red-500/20">
                            #{tag.trim()}
                          </span>
                        ))}
                      </div>
                    );
                  })()}

                  <div className="mt-2">
                    <Chip icon={<IconClock size={13} strokeWidth={2.5} className="text-accent" />} className="bg-accent/15 text-accent border border-accent/20 font-black">
                      {(() => {
                        const parsed = parseVisitTime(selectedRecipient.visit_time, selectedRecipient.notes);
                        return parsed.hasTime ? `${parsed.formattedText} 방문` : '서비스 시간 미정';
                      })()}
                    </Chip>
                  </div>
                </div>

                {/* Visit action & edit actions */}
                <div className="flex gap-1.5 shrink-0">
{Boolean(visitPrimaryLabel(selectedRecipient, detailDateKey)) && (<IconButton
                    onClick={() => toggleCompleted(selectedRecipient, detailDateKey)}
                    disabled={visitSaving || visits.loading}
                    className={`w-11 h-11 rounded-[18px] transition-all ${isSelectedVisitCompleted(selectedRecipient) ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30' : 'bg-surface-muted text-foreground/50 hover:bg-surface-border'}`}
                    aria-label={visitPrimaryLabel(selectedRecipient, detailDateKey)}
                  >
                    {visitActionIcon(selectedRecipient, detailDateKey, 20)}
                  </IconButton>)}
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

                <button type="button" onClick={() => openScheduleManagement(selectedRecipient, detailDateKey)} className="rounded-2xl border border-surface-border px-3 py-2 text-sm font-bold text-left">
                  일정 관리 · {detailDateKey} · {VISIT_STATUS_LABEL[getVisit(selectedRecipient, detailDateKey).status]}
                </button>

              {/* One UI 9.0 Quick Action Pill Bar */}
              <div className="grid grid-cols-3 gap-2 my-4">
                <button
                  onClick={() => handleDirections(selectedRecipient.lat, selectedRecipient.lng, selectedRecipient.address, selectedRecipient.detail_address)}
                  className="py-3 px-1 rounded-[20px] bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 flex flex-col items-center justify-center gap-1 active:scale-95 transition-all shadow-sm"
                >
                  <IconNavigation size={20} />
                  <span className="text-[12px] font-black">길안내</span>
                </button>



                <button
                  onClick={() => openPrintRecipient(selectedRecipient, detailDateKey)}
                  className="py-3 px-1 rounded-[20px] bg-foreground/[0.04] hover:bg-foreground/[0.08] text-foreground/75 flex flex-col items-center justify-center gap-1 active:scale-95 transition-all border border-surface-border/40"
                >
                  <IconPrinter size={20} />
                  <span className="text-[12px] font-black">출력</span>
                </button>
              </div>

              {/* Today Completed Visit Memo Inset */}
              {isSelectedVisitCompleted(selectedRecipient) && getVisit(selectedRecipient, detailDateKey).memo && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-[24px] p-4 my-3 relative">
                  <div className="text-[11px] font-black uppercase tracking-wider text-emerald-600 mb-1">{detailDateKey} 방문 일지</div>
                  <p className="text-[14px] font-bold text-foreground/85 whitespace-pre-wrap leading-relaxed">
                    {getVisit(selectedRecipient, detailDateKey).memo}
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
                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={() => handleNavi('system', selectedRecipient.lat, selectedRecipient.lng, selectedRecipient.address, selectedRecipient.detail_address)}
                    className="p-2.5 bg-surface border border-surface-border/60 rounded-[18px] flex flex-col items-center justify-center gap-1.5 hover:bg-surface-muted transition-all active:scale-95 shadow-2xs"
                  >
                    <div className="w-6 h-6 rounded-[8px] bg-blue-500/10 text-blue-500 flex items-center justify-center">
                      <IconNavigation size={15} />
                    </div>
                    <span className="text-[12px] font-black text-foreground/80">기본 지도</span>
                  </button>

                  <button
                    onClick={() => handleNavi('tmap', selectedRecipient.lat, selectedRecipient.lng, selectedRecipient.address, selectedRecipient.detail_address)}
                    className="p-2.5 bg-surface border border-surface-border/60 rounded-[18px] flex flex-col items-center justify-center gap-1.5 hover:bg-surface-muted transition-all active:scale-95 shadow-2xs"
                  >
                    <div className="w-6 h-6 rounded-[8px] bg-red-500 text-white flex items-center justify-center font-black text-sm" aria-hidden="true">
                      T
                    </div>
                    <span className="text-[12px] font-black text-foreground/80">T맵</span>
                  </button>

                  <button
                    onClick={() => handleNavi('kakao', selectedRecipient.lat, selectedRecipient.lng, selectedRecipient.address, selectedRecipient.detail_address)}
                    className="p-2.5 bg-surface border border-surface-border/60 rounded-[18px] flex flex-col items-center justify-center gap-1.5 hover:bg-surface-muted transition-all active:scale-95 shadow-2xs"
                  >
                    <div className="w-6 h-6 rounded-[8px] bg-yellow-400 text-stone-900 flex items-center justify-center" aria-hidden="true">
                      <IconMapPin size={16} />
                    </div>
                    <span className="text-[12px] font-black text-foreground/80">카카오</span>
                  </button>

                  <button
                    onClick={() => handleNavi('naver', selectedRecipient.lat, selectedRecipient.lng, selectedRecipient.address, selectedRecipient.detail_address)}
                    className="p-2.5 bg-surface border border-surface-border/60 rounded-[18px] flex flex-col items-center justify-center gap-1.5 hover:bg-surface-muted transition-all active:scale-95 shadow-2xs"
                  >
                    <div className="w-6 h-6 rounded-[8px] bg-green-600 text-white flex items-center justify-center font-black text-sm" aria-hidden="true">
                      N
                    </div>
                    <span className="text-[12px] font-black text-foreground/80">네이버</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* iOS Cupertino Native Tab Bar (Ultra-thin Frosted Glass Material) */}
      <nav
        id="tour-bottom-nav"
        className="app-bottom-nav fixed bottom-0 left-0 right-0 z-50 bg-white/85 dark:bg-[#121214]/85 backdrop-blur-2xl saturate-150 border-t border-black/[0.08] dark:border-white/[0.1] pb-[max(var(--app-safe-bottom),8px)] pt-2 px-3 shadow-[0_-4px_24px_rgba(0,0,0,0.03)] select-none pointer-events-auto"
      >
        <div className="max-w-md mx-auto flex h-12 items-center justify-around">
          {([
            { key: 'map' as const, label: '지도', Icon: IconMapPin },
            {
              key: 'list' as const,
              label: '수급자',
              Icon: IconUsers,
              badge: markers.length > 0 ? String(markers.length) : undefined,
              badgeColor: 'bg-[#8E8E93] text-white'
            },
            {
              key: 'route' as const,
              label: '일정',
              Icon: IconCalendarEvent,
              badge: (() => {
                const todayCount = markers.filter(m => getScheduledForDate(m, new Date())).length;
                const completedCount = markers.filter(m => getScheduledForDate(m, new Date()) && isCompletedToday(m)).length;
                const remaining = markers.filter(m => getScheduledForDate(m, new Date()) && ['planned', 'in_progress'].includes(getVisit(m).status)).length;
                if (todayCount === 0) return undefined;
                if (remaining === 0) return completedCount === todayCount ? '✓' : undefined;
                return String(remaining);
              })(),
              badgeColor: (() => {
                const todayCount = markers.filter(m => getScheduledForDate(m, new Date())).length;
                const completedCount = markers.filter(m => getScheduledForDate(m, new Date()) && isCompletedToday(m)).length;
                if (todayCount > 0 && todayCount === completedCount) return 'bg-[#34C759] text-white font-bold';
                return 'bg-[#FF9500] text-white font-bold';
              })()
            },
            { key: 'settings' as const, label: '설정', Icon: IconSettings },
          ]).map(({ key, label, Icon, badge, badgeColor }) => {
            const isActive = activeTab === key;
            return (
              <motion.button
                key={key}
                type="button"
                whileTap={{ scale: 0.88 }}
                onClick={() => setActiveTab(key)}
                className={`relative flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${
                  isActive ? 'text-[#007AFF] font-bold' : 'text-[#8E8E93] dark:text-[#98989D] hover:text-foreground font-medium'
                }`}
              >
                <div className="relative flex items-center justify-center">
                  <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                  {badge && (
                    <span className={`absolute -top-1 -right-3 text-[10px] min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center shadow-xs font-bold leading-none ${badgeColor || 'bg-[#FF3B30] text-white'}`}>
                      {badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] tracking-tight leading-none">{label}</span>
              </motion.button>
            );
          })}
        </div>
      </nav>

      <VisitCompletionModal key={completingRecipient ? `${completingRecipient.id}:${completingDateKey}` : 'none'} isOpen={Boolean(completingRecipient)} onClose={() => { if (!visitSaving) setCompletingRecipient(null); }} onSave={handleSaveMemo} recipientName={completingRecipient?.name || ''} recipientId={completingRecipient?.id} initialMemo={completingRecipient ? getVisit(completingRecipient, completingDateKey || todayKey).memo : null} saving={visitSaving} saveError={visitActionError} visitDateLabel={completingDateKey} />
      <Modal open={isPrintMenuOpen} onClose={() => setIsPrintMenuOpen(false)}>
        <div className="space-y-3 p-5 text-foreground">
          <div className="flex items-center justify-between gap-2"><h2 className="text-xl font-bold">출력</h2><IconButton aria-label="닫기" onClick={() => setIsPrintMenuOpen(false)}><IconX size={20} /></IconButton></div>
          <p className="text-sm text-foreground/70">출력할 범위를 선택하세요.</p>
          {printMenuTarget && <Button fullWidth variant="ghost" onClick={() => choosePrint('recipient')}>{printMenuTarget.recipient.name} 수급자 정보</Button>}
          <Button fullWidth variant="ghost" disabled={visits.loading || Boolean(visits.error) || !scheduleRoute.length} onClick={() => choosePrint('day')}>선택 날짜 일정 · {selectedDateKey} · {scheduleRoute.length}명</Button>
          <Button fullWidth variant="ghost" disabled={visits.loading || Boolean(visits.error) || !weekDays.some(day => day.recipients.length)} onClick={() => choosePrint('week')}>선택한 주 일정 · {weekLabel}</Button>
        </div>
      </Modal>
      <PrintProfileModal
        isOpen={Boolean(printingRecipient)}
        onClose={() => setPrintingRecipient(null)}
        recipient={printingRecipient}
        dateKey={printingDateKey || todayKey}
      />

      <BatchPrintModal
        isOpen={isBatchPrintOpen}
        onClose={() => setIsBatchPrintOpen(false)}
        recipients={scheduleDate ? scheduleRoute.map((r) => ({ ...projectVisitForDate(r, selectedDateKey), completed: isCompletedForDate(r, scheduleDate) })) : scheduleRoute}
        dateKey={selectedDateKey}
        dateLabel={scheduleDate ? `${scheduleDate.getMonth() + 1}월 ${scheduleDate.getDate()}일` : undefined}
      />

      <WeeklyPrintModal
        isOpen={isWeeklyPrintOpen}
        onClose={() => setIsWeeklyPrintOpen(false)}
        days={weekDays}
        weekLabel={weekLabel}
      />

      {selectedRecipient && (
        <VitalsHistorySheet
          open={isVitalsHistoryOpen}
          onClose={() => setIsVitalsHistoryOpen(false)}
          recipientId={selectedRecipient.id}
          recipientName={selectedRecipient.name}
        />
      )}

      {selectedRecipient && (
        <MedicationModal
          open={isMedicationModalOpen}
          onClose={() => setIsMedicationModalOpen(false)}
          recipientId={selectedRecipient.id}
          recipientName={selectedRecipient.name}
        />
      )}

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
      <Modal open={Boolean(removingActiveVisit)} onClose={() => { if (!visitSaving) setRemovingActiveVisit(null); }}>
        <div className="space-y-4 p-5 text-foreground">
          <h2 className="text-xl font-bold">진행 중인 방문을 제거할까요?</h2>
          <p className="text-sm leading-relaxed">{removingActiveVisit?.recipient.name} 어르신의 방문을 취소하고 {removingActiveVisit?.dateKey} 일정에서 제거합니다. 다른 날짜와 방문 이력은 유지됩니다.</p>
          <div className="flex flex-wrap gap-2"><Button variant="ghost" disabled={visitSaving} onClick={() => setRemovingActiveVisit(null)}>계속 방문</Button><Button variant="danger-ghost" loading={visitSaving} onClick={() => { if (removingActiveVisit) void removeScheduleDate(removingActiveVisit.recipient, removingActiveVisit.dateKey, removingActiveVisit.version); }}>이번 일정 제거</Button></div>
          {visitActionError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{visitActionError}</p>}
        </div>
      </Modal>
      <ScheduleManageModal
        isOpen={Boolean(managingScheduleRecipient)}
        onClose={() => setManagingScheduleRecipient(null)}
        recipient={managingScheduleRecipient}
        removeDisabled={visitSaving || visits.loading || Boolean(visits.error)}
        onRemove={() => { const target = managingScheduleRecipient; setManagingScheduleRecipient(null); if (target) handleRemoveFromSchedule(target, scheduleDate || new Date()); }}
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
          fetchMarkers();
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
function AuthenticatedPage() {
  return <AuthGate>{(user, signOut) => <MainApp key={user.id} accountEmail={user.email} onSignOut={signOut} />}</AuthGate>;
}
export default dynamic(() => Promise.resolve(AuthenticatedPage), { ssr: false });
