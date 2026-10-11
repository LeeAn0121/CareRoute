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
  door_passcode?: string | null;
  parking_memo?: string | null;
  health_tags?: string | null;
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
  
  const [visitDate, setVisitDate] = useState('');
  
  const [doorPasscode, setDoorPasscode] = useState('');
  const [parkingMemo, setParkingMemo] = useState('');
  const [healthTags, setHealthTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
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
        setVisitDate(recipientToEdit.notes || '');
        
      // @ts-ignore
      setDoorPasscode(recipientToEdit.door_passcode || '');
      // @ts-ignore
      setParkingMemo(recipientToEdit.parking_memo || '');
      // @ts-ignore
      setHealthTags(recipientToEdit.health_tags ? recipientToEdit.health_tags.split(',').filter(Boolean) : []);
        setExistingPhotoUrl(recipientToEdit.photo_url || null);
      } else {
        setName('');
        setAddress('');
        setDetailAddress('');
        setBcode('');
        
        setVisitDate('');
        
      setDoorPasscode('');
      setParkingMemo('');
      setHealthTags([]);
      setCustomTag('');
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
        visit_time: recipientToEdit?.visit_time || '00:00:00',
        notes: recipientToEdit?.notes || null, // Preserve existing specific dates
        recurring_weekdays: recipientToEdit?.recurring_weekdays || null,
        photo_url: photoUrl,
        door_passcode: doorPasscode.trim() || null,
        parking_memo: parkingMemo.trim() || null,
        health_tags: healthTags.length > 0 ? healthTags.join(',') : null,
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
      <div className="flex items-center justify-between px-6 pt-6 pb-2">
        <div>
          <h2 className="text-[20px] font-black text-foreground tracking-tight">
            {recipientToEdit ? '어르신 정보 수정' : '새 어르신 등록'}
          </h2>
          <p className="text-[12px] font-bold text-foreground/50">방문 관리에 필요한 필수 정보를 입력해주세요</p>
        </div>
        <IconButton onClick={onClose} disabled={isSubmitting} className="w-9 h-9 rounded-full bg-foreground/[0.04] hover:bg-foreground/[0.08]" aria-label="닫기">
          <IconX size={18} />
        </IconButton>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="flex flex-col gap-4 px-6 py-3">
          {/* Avatar Upload Pebble */}
          <div className="flex justify-center my-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={isSubmitting}
                className="w-24 h-24 rounded-[28px] overflow-hidden bg-primary/5 flex items-center justify-center border-2 border-dashed border-surface-border/80 transition-colors hover:border-primary shadow-2xs"
                aria-label="사진 선택"
              >
                {photoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoPreview} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-foreground/45">
                    <IconUser size={32} />
                    <span className="text-[11px] font-black">사진 등록</span>
                  </div>
                )}
              </button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                onClick={() => photoInputRef.current?.click()}
                disabled={isSubmitting}
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center border-2 border-surface shadow-md"
                aria-label="사진 촬영/선택"
              >
                <IconCamera size={15} />
              </motion.button>
              {photoPreview && (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.9 }}
                  onClick={() => { setPhotoFile(null); setExistingPhotoUrl(null); if (photoInputRef.current) photoInputRef.current.value = ''; }}
                  disabled={isSubmitting}
                  className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-surface text-red-500 shadow-md border border-surface-border flex items-center justify-center"
                  aria-label="사진 제거"
                >
                  <IconX size={13} strokeWidth={2.5} />
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

          {/* Grouped Inset: Basic Info */}
          <div className="bg-foreground/[0.03] dark:bg-white/[0.04] p-4 rounded-[26px] border border-surface-border/40 flex flex-col gap-3.5">
            <p className="text-[13px] font-black text-primary tracking-tight pl-1">기본 정보</p>
            <TextField
              label="성함"
              required
              placeholder="예: 김순자"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                if (!recipientToEdit && name.trim() && !address) {
                  handleSearchAddress();
                }
              }}
              disabled={isSubmitting}
            />

            <div className="flex items-end gap-2">
              <div className="flex-1">
                <TextField label="기본 주소" required value={address} placeholder="도로명 또는 지번 주소" disabled />
              </div>
              <Button
                type="button"
                onClick={handleSearchAddress}
                disabled={isSubmitting}
                startIcon={<IconSearch size={18} />}
                className="mb-[1px] rounded-[18px] px-5 font-black text-sm"
              >
                검색
              </Button>
            </div>

            <TextField
              label="상세 주소 (동/호수, 층 등)"
              placeholder="예: 101동 302호"
              value={detailAddress}
              onChange={(e) => setDetailAddress(e.target.value)}
              disabled={isSubmitting}
              inputRef={detailAddressRef}
            />
          </div>

          {/* Grouped Inset: Health Tags */}
          <div className="bg-foreground/[0.03] dark:bg-white/[0.04] p-4 rounded-[26px] border border-surface-border/40 flex flex-col gap-3">
            <p className="text-[13px] font-black text-primary tracking-tight pl-1">건강 및 케어 특이사항</p>
            <div className="flex flex-wrap gap-1.5">
              {['치매', '당뇨', '고혈압', '거동불편', '청각장애', '시각장애', '와상'].map(tag => {
                const isActive = healthTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      if (isActive) setHealthTags(prev => prev.filter(t => t !== tag));
                      else setHealthTags(prev => [...prev, tag]);
                    }}
                    className={`px-3 py-1.5 rounded-full text-[12px] font-black border transition-all active:scale-95 ${
                      isActive 
                        ? 'bg-red-500/15 text-red-600 border-red-500/30 shadow-2xs' 
                        : 'bg-surface text-foreground/60 border-surface-border/60 hover:bg-surface-muted'
                    }`}
                  >
                    #{tag}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 pt-1">
              <input
                type="text"
                placeholder="직접 태그 입력 (예: 식사보조)"
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (customTag.trim() && !healthTags.includes(customTag.trim())) {
                      setHealthTags(prev => [...prev, customTag.trim()]);
                      setCustomTag('');
                    }
                  }
                }}
                className="flex-1 px-4 py-2.5 text-[13px] font-bold border border-surface-border/60 rounded-[16px] bg-surface/90 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                type="button"
                onClick={() => {
                  if (customTag.trim() && !healthTags.includes(customTag.trim())) {
                    setHealthTags(prev => [...prev, customTag.trim()]);
                    setCustomTag('');
                  }
                }}
                className="px-4 py-2.5 bg-primary/10 hover:bg-primary/15 text-primary rounded-[16px] text-[13px] font-black active:scale-95 transition-all"
              >
                추가
              </button>
            </div>
            {healthTags.filter(t => !['치매', '당뇨', '고혈압', '거동불편', '청각장애', '시각장애', '와상'].includes(t)).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {healthTags.filter(t => !['치매', '당뇨', '고혈압', '거동불편', '청각장애', '시각장애', '와상'].includes(t)).map(tag => (
                  <div key={tag} className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-black bg-red-500/15 text-red-600 border border-red-500/30">
                    <span>#{tag}</span>
                    <button type="button" onClick={() => setHealthTags(prev => prev.filter(t => t !== tag))} className="text-red-400 hover:text-red-700">
                      <IconX size={13} strokeWidth={2.5} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Grouped Inset: Door & Parking Info */}
          <div className="bg-foreground/[0.03] dark:bg-white/[0.04] p-4 rounded-[26px] border border-surface-border/40 flex flex-col gap-3">
            <p className="text-[13px] font-black text-primary tracking-tight pl-1">현장 출입 편의 정보</p>
            <TextField
              label="공동현관 비밀번호 (선택)"
              placeholder="예: 🔔1234#"
              value={doorPasscode}
              onChange={(e) => setDoorPasscode(e.target.value)}
              disabled={isSubmitting}
            />
            <TextField
              label="주차 꿀팁 메모 (선택)"
              placeholder="예: 빌라 뒤편 1층 지정 주차구역"
              value={parkingMemo}
              onChange={(e) => setParkingMemo(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

        </div>

        <div className="px-6 pb-6 pt-2">
          <Button type="submit" fullWidth loading={isSubmitting} className="py-3.5 text-[16px] font-black rounded-[22px] shadow-lg shadow-primary/20">
            {recipientToEdit ? '수정 내용 저장하기' : '어르신 등록 완료'}
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
