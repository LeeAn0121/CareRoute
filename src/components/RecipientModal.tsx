'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { DaumPostcodeEmbed } from 'react-daum-postcode';
import { IconX, IconSearch, IconCamera, IconUser } from '@tabler/icons-react';
import { motion } from 'motion/react';
import { Button, IconButton, Modal, TextField } from './ui';

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
  recurring_weekdays?: string | null;
  photo_url?: string | null;
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

interface RecipientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  recipientToEdit?: Recipient | null;
}

export default function RecipientModal({ isOpen, onClose, onSuccess, recipientToEdit }: RecipientModalProps) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [detailAddress, setDetailAddress] = useState('');
  const [bcode, setBcode] = useState('');
  const [visitTime, setVisitTime] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [recurringDays, setRecurringDays] = useState<number[]>([]);
  const [doorPasscode, setDoorPasscode] = useState('');
  const [parkingMemo, setParkingMemo] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddressSearchOpen, setIsAddressSearchOpen] = useState(false);
  const detailAddressRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // 새로 고른 파일이 있으면 그 로컬 미리보기를, 없으면 기존 저장된 사진을 보여준다.
  // object URL은 교체/언마운트 시 꼭 해제해서 메모리 누수를 막는다.
  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview(existingPhotoUrl);
      return;
    }
    const url = URL.createObjectURL(photoFile);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile, existingPhotoUrl]);

  useEffect(() => {
    if (isOpen) {
      if (recipientToEdit) {
        setName(recipientToEdit.name);
        setAddress(recipientToEdit.address);
        setDetailAddress(recipientToEdit.detail_address || '');
        setBcode(recipientToEdit.dong);
        setVisitTime((recipientToEdit.visit_time && recipientToEdit.visit_time.substring(0, 5) !== '00:00') ? recipientToEdit.visit_time.substring(0, 5) : '');
        setVisitDate(recipientToEdit.notes || '');
        setRecurringDays(recipientToEdit.recurring_weekdays ? recipientToEdit.recurring_weekdays.split(',').map(Number) : []);
      // @ts-ignore
      setDoorPasscode(recipientToEdit.door_passcode || '');
      // @ts-ignore
      setParkingMemo(recipientToEdit.parking_memo || '');
        setExistingPhotoUrl(recipientToEdit.photo_url || null);
      } else {
        setName('');
        setAddress('');
        setDetailAddress('');
        setBcode('');
        setVisitTime('');
        setVisitDate('');
        setRecurringDays([]);
      setDoorPasscode('');
      setParkingMemo('');
        setExistingPhotoUrl(null);
      }
      setPhotoFile(null);
      setIsSubmitting(false);
    }
  }, [isOpen, recipientToEdit]);

  const handleComplete = (data: any) => {
    let fullAddress = data.address;
    let extraAddress = '';

    if (data.addressType === 'R') {
      if (data.bname !== '') extraAddress += data.bname;
      if (data.buildingName !== '') extraAddress += extraAddress !== '' ? `, ${data.buildingName}` : data.buildingName;
      fullAddress += extraAddress !== '' ? ` (${extraAddress})` : '';
    }

    setAddress(fullAddress);
    setBcode(data.bcode);
    setIsAddressSearchOpen(false);
    // 다이얼로그 닫힘 애니메이션/포커스 복원과 충돌하지 않도록 한 틱 늦춰서 포커스
    setTimeout(() => detailAddressRef.current?.focus(), 150);
  };

  const handleSearchAddress = () => {
    setIsAddressSearchOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !address) {
      alert('이름과 주소를 입력해주세요.');
      return;
    }
    if (!bcode) {
      alert('구형 데이터입니다. [주소 검색] 버튼을 눌러 주소를 다시 한 번만 선택해주세요!');
      return;
    }

    setIsSubmitting(true);

    try {
      const getLatLng = async (): Promise<{ lat: number; lng: number }> => {
        try {
          return await new Promise((resolve, reject) => {
            if (!window.naver || !window.naver.maps || !window.naver.maps.Service) {
              reject(new Error('Naver Map API failed'));
              return;
            }
            // @ts-ignore
            window.naver.maps.Service.geocode({ query: address }, function(status, response) {
              // @ts-ignore
              if (status === window.naver.maps.Service.Status.OK && response.v2.addresses.length > 0) {
                const item = response.v2.addresses[0];
                resolve({ lat: parseFloat(item.y), lng: parseFloat(item.x) });
              } else {
                reject(new Error('Address not found'));
              }
            });
          });
        } catch (error) {
          console.warn('Fallback to OSM:', error);
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
          const data = await res.json();
          if (data && data.length > 0) {
            return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
          }
          throw new Error('주소를 찾을 수 없습니다.');
        }
      };

      let coords = { lat: 37.5665, lng: 126.9780 }; // Default fallback

      // If editing and address is identical to the original base address, keep old coords
      const isAddressUnchanged = recipientToEdit && recipientToEdit.address.startsWith(address);

      if (isAddressUnchanged) {
        coords = { lat: recipientToEdit!.lat, lng: recipientToEdit!.lng };
      } else {
        try {
          coords = await getLatLng();
        } catch (e) {
          console.warn('Geocoding completely failed. Using OSM fallback...', e);
          try {
            const shortAddress = address.split(' ').slice(0, 3).join(' ');
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(shortAddress)}`);
            const data = await res.json();
            if (data && data.length > 0) {
              coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
            } else if (recipientToEdit) {
              coords = { lat: recipientToEdit.lat, lng: recipientToEdit.lng };
            }
          } catch (osmError) {
             if (recipientToEdit) {
               coords = { lat: recipientToEdit.lat, lng: recipientToEdit.lng };
             }
          }
        }
      }

      let photoUrl = existingPhotoUrl;
      if (photoFile) {
        const ext = photoFile.name.split('.').pop() || 'jpg';
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('recipient-photos').upload(path, photoFile);
        if (uploadError) throw uploadError;
        const { data: publicUrlData } = supabase.storage.from('recipient-photos').getPublicUrl(path);
        photoUrl = publicUrlData.publicUrl;
      }

      const recipientData = {
        name,
        address,
        detail_address: detailAddress || null,
        sido: bcode.substring(0, 2) + '00000000',
        sigungu: bcode.substring(0, 5) + '00000',
        dong: bcode,
        lat: coords.lat,
        lng: coords.lng,
        visit_time: visitTime ? `${visitTime}:00` : '00:00:00',
        notes: visitDate,
        recurring_weekdays: recurringDays.length > 0 ? [...recurringDays].sort().join(',') : null,
        photo_url: photoUrl,
      };

      if (recipientToEdit?.id) {
        const { error } = await supabase.from('recipients').update(recipientData).eq('id', recipientToEdit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('recipients').insert([recipientData]);
        if (error) throw error;
      }

      onSuccess();
    } catch (error: any) {
      alert(`오류가 발생했습니다: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={() => { if (!isSubmitting && !isAddressSearchOpen) onClose(); }}
      closeOnBackdrop={!isSubmitting && !isAddressSearchOpen}
    >
      <div className="flex items-center justify-between px-5 pt-5 pb-2">
        <h2 className="text-lg font-extrabold text-primary">
          {recipientToEdit ? '어르신 정보 수정' : '새 어르신 등록'}
        </h2>
        <IconButton onClick={onClose} disabled={isSubmitting} className="hover:bg-surface-muted" aria-label="닫기">
          <IconX size={20} />
        </IconButton>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="flex flex-col gap-5 px-5 py-3">
          <div className="flex justify-center">
            <div className="relative">
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={isSubmitting}
                className="w-24 h-24 rounded-full overflow-hidden bg-primary/5 flex items-center justify-center border-2 border-dashed border-surface-border transition-colors hover:border-amber-400"
                aria-label="사진 선택"
              >
                {photoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoPreview} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-foreground/50">
                    <IconUser size={32} />
                    <span className="text-[11px] font-bold">사진 추가</span>
                  </div>
                )}
              </button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                onClick={() => photoInputRef.current?.click()}
                disabled={isSubmitting}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center border-2 border-surface shadow-md"
                aria-label="사진 촬영/선택"
              >
                <IconCamera size={16} />
              </motion.button>
              {photoPreview && (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.9 }}
                  onClick={() => { setPhotoFile(null); setExistingPhotoUrl(null); if (photoInputRef.current) photoInputRef.current.value = ''; }}
                  disabled={isSubmitting}
                  className="absolute top-0 right-0 w-6 h-6 rounded-full bg-surface text-red-500 shadow flex items-center justify-center"
                  aria-label="사진 제거"
                >
                  <IconX size={14} />
                </motion.button>
              )}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-[13px] font-black text-primary/80 tracking-tight">기본 정보</p>
            <TextField
              label="성함"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                // 신규 등록 시 성함을 입력하고 다음 항목으로 넘어가면
                // 바로 주소 검색을 띄워 한 번에 이어서 입력할 수 있게 한다.
                if (!recipientToEdit && name.trim() && !address) {
                  handleSearchAddress();
                }
              }}
              disabled={isSubmitting}
            />

            <div className="flex items-end gap-2">
              <div className="flex-1">
                <TextField label="기본 주소" required value={address} disabled />
              </div>
              <Button
                type="button"
                onClick={handleSearchAddress}
                disabled={isSubmitting}
                startIcon={<IconSearch size={18} />}
                className="mb-[1px]"
              >
                검색
              </Button>
            </div>

            <TextField
              label="상세 주소 (선택)"
              value={detailAddress}
              onChange={(e) => setDetailAddress(e.target.value)}
              disabled={isSubmitting}
              inputRef={detailAddressRef}
            />
          </div>

          <div className="h-px bg-surface-muted" />

          <div className="flex flex-col gap-3">
            <p className="text-[13px] font-black text-primary/80 tracking-tight">현장 편의 정보</p>
            <TextField
              label="공동현관 비밀번호 (선택)"
              placeholder="예: 🔔1234#"
              value={doorPasscode}
              onChange={(e) => setDoorPasscode(e.target.value)}
              disabled={isSubmitting}
            />
            <TextField
              label="주차 꿀팁 메모 (선택)"
              placeholder="예: 빌라 뒤쪽 공터에 주차 가능"
              value={parkingMemo}
              onChange={(e) => setParkingMemo(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="h-px bg-surface-muted" />

          <div className="flex flex-col gap-3">
            <p className="text-[13px] font-black text-primary/80 tracking-tight">방문 일정</p>
            <TextField
              label="방문 예정일 (선택)"
              type="date"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              disabled={isSubmitting}
              endAdornment={visitDate ? (
                <IconButton onClick={() => setVisitDate('')} aria-label="방문 예정일 지우기">
                  <IconX size={16} />
                </IconButton>
              ) : null}
            />

            <div>
              <span className="block text-sm font-bold text-foreground/70 mb-1">반복 요일 (선택)</span>
              <div className="flex gap-1.5">
                {WEEKDAY_LABELS.map((label, day) => {
                  const active = recurringDays.includes(day);
                  return (
                    <motion.button
                      key={day}
                      type="button"
                      whileTap={{ scale: 0.88 }}
                      disabled={isSubmitting}
                      onClick={() => {
                        setRecurringDays((prev) =>
                          prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
                        );
                      }}
                      animate={{
                        backgroundColor: active ? 'var(--accent)' : 'var(--color-surface-muted)',
                        color: active ? 'var(--primary)' : 'var(--color-foreground)',
                      }}
                      transition={{ duration: 0.15 }}
                      className="w-9 h-9 rounded-full text-sm font-bold"
                    >
                      {label}
                    </motion.button>
                  );
                })}
              </div>
              {recurringDays.length > 0 && (
                <p className="text-xs text-foreground/50 mt-1.5">매주 {recurringDays.slice().sort().map((d) => WEEKDAY_LABELS[d]).join(', ')}요일마다 방문 예정에 자동으로 포함됩니다.</p>
              )}
            </div>

            <TextField
              label="방문 예정 서비스 시간 (선택)"
              type="time"
              value={visitTime}
              onChange={(e) => setVisitTime(e.target.value)}
              disabled={isSubmitting}
              endAdornment={visitTime ? (
                <IconButton onClick={() => setVisitTime('')} aria-label="방문 예정 서비스 시간 지우기">
                  <IconX size={16} />
                </IconButton>
              ) : null}
            />
          </div>
        </div>

        <div className="px-5 pb-5 pt-2">
          <Button type="submit" fullWidth loading={isSubmitting} className="py-3 text-base">
            저장하기
          </Button>
        </div>
      </form>

      {/* 주소 검색: window.open 팝업 대신 다이얼로그에 임베드해서 연다.
          PWA를 홈 화면에 설치해 standalone 모드로 실행 중이면 팝업창이
          열리지 않거나 opener와의 콜백 연결이 끊기는 경우가 흔하기 때문. */}
      <Modal open={isAddressSearchOpen} onClose={() => setIsAddressSearchOpen(false)}>
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <h2 className="text-lg font-extrabold text-primary">주소 검색</h2>
          <IconButton onClick={() => setIsAddressSearchOpen(false)} aria-label="닫기">
            <IconX size={20} />
          </IconButton>
        </div>
        <div style={{ height: 500 }}>
          {isAddressSearchOpen && (
            <DaumPostcodeEmbed
              scriptUrl="https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"
              onComplete={handleComplete}
              autoClose={false}
              style={{ width: '100%', height: '100%' }}
            />
          )}
        </div>
      </Modal>
    </Modal>
  );
}
