'use client';

import { useState, useEffect } from 'react';
import DaumPostcode from 'react-daum-postcode';
import { X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Recipient {
  id?: string;
  name: string;
  address: string;
  sido: string;
  sigungu: string;
  dong: string;
  lat: number;
  lng: number;
  visit_time: string;
}

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
  const [bcode, setBcode] = useState(''); // 법정동 코드 (10자리)
  const [visitTime, setVisitTime] = useState('10:00');
  
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (recipientToEdit) {
        setName(recipientToEdit.name);
        
        // 기존 주소에서 상세주소를 분리하려는 간단한 시도 (완벽하진 않음)
        // 하지만 편의상 통째로 놔두거나 쪼갤 수 있음. 가장 쉬운 방법은 그냥 그대로 두는 것
        // 사용자가 다시 수정하면 됨
        setAddress(recipientToEdit.address);
        setDetailAddress('');
        
        setBcode(recipientToEdit.dong);
        setVisitTime(recipientToEdit.visit_time.substring(0, 5));
      } else {
        setName('');
        setAddress('');
        setDetailAddress('');
        setBcode('');
        setVisitTime('10:00');
      }
      setIsSearchingAddress(false);
    }
  }, [isOpen, recipientToEdit]);

  if (!isOpen) return null;

  const handleCompletePostcode = (data: any) => {
    setAddress(data.address);
    setBcode(data.bcode); // 10자리 법정동 코드
    setIsSearchingAddress(false);
  };

  const handleSubmit = async () => {
    if (!name || !address || !bcode || !visitTime) {
      alert('필수 정보를 모두 입력해주세요.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 주소를 위경도로 변환 (네이버 Geocoder)
      const getLatLng = async (): Promise<{ lat: number; lng: number }> => {
        try {
          return await new Promise((resolve, reject) => {
            if (!window.naver || !window.naver.maps || !window.naver.maps.Service) {
              reject(new Error('네이버 지도 API를 불러오지 못했습니다.'));
              return;
            }
            // @ts-ignore
            window.naver.maps.Service.geocode({ query: address }, function(status, response) {
              // @ts-ignore
              if (status === window.naver.maps.Service.Status.OK && response.v2.addresses.length > 0) {
                const item = response.v2.addresses[0];
                resolve({ lat: parseFloat(item.y), lng: parseFloat(item.x) });
              } else {
                reject(new Error('네이버 지도에서 주소를 찾을 수 없습니다.'));
              }
            });
          });
        } catch (error) {
          console.warn('네이버 Geocoding 실패, OpenStreetMap으로 대체합니다:', error);
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
          const data = await res.json();
          if (data && data.length > 0) {
            return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
          }
          throw new Error('입력하신 주소를 찾을 수 없습니다.');
        }
      };

      const coords = await getLatLng();
      const finalAddress = detailAddress ? `${address} ${detailAddress}` : address;

      const recipientData = {
        name,
        address: finalAddress,
        sido: bcode.substring(0, 2) + '00000000',
        sigungu: bcode.substring(0, 5) + '00000',
        dong: bcode,
        lat: coords.lat,
        lng: coords.lng,
        visit_time: visitTime + ':00'
      };

      if (recipientToEdit?.id) {
        // 수정
        const { error } = await supabase.from('recipients').update(recipientData).eq('id', recipientToEdit.id);
        if (error) throw error;
      } else {
        // 추가
        const { error } = await supabase.from('recipients').insert([recipientData]);
        if (error) throw error;
      }
      
      onSuccess();
      onClose();
    } catch (e: any) {
      alert('오류가 발생했습니다: ' + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 animate-in fade-in duration-200">
      <div className="bg-white w-full sm:w-[400px] h-[85vh] sm:h-auto sm:max-h-[90vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-800">
            {recipientToEdit ? '수급자 정보 수정' : '새 수급자 추가'}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* 주소 검색창 오버레이 */}
          {isSearchingAddress ? (
            <div className="border border-slate-200 rounded-xl overflow-hidden h-[400px]">
              <DaumPostcode onComplete={handleCompletePostcode} style={{ width: '100%', height: '100%' }} />
              <button 
                className="w-full py-3 bg-slate-100 text-slate-600 font-medium"
                onClick={() => setIsSearchingAddress(false)}
              >
                주소 검색 취소
              </button>
            </div>
          ) : (
            <>
              {/* 이름 입력 */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">이름</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  placeholder="예: 김할머니"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 transition-shadow"
                />
              </div>

              {/* 주소 입력 */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">주소</label>
                <div className="flex gap-2 mb-2">
                  <input 
                    type="text" 
                    value={address} 
                    readOnly
                    placeholder="주소 검색을 눌러주세요"
                    className="flex-1 px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-600 cursor-not-allowed focus:outline-none"
                  />
                  <button 
                    onClick={() => setIsSearchingAddress(true)}
                    className="px-4 py-3 bg-teal-50 text-teal-600 font-semibold rounded-xl hover:bg-teal-100 transition-colors whitespace-nowrap"
                  >
                    검색
                  </button>
                </div>
                <input 
                  type="text" 
                  value={detailAddress} 
                  onChange={(e) => setDetailAddress(e.target.value)}
                  placeholder="상세주소 (동, 호수 등 - 선택사항)"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 transition-shadow"
                />
              </div>

              {/* 방문 시간 입력 */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">방문 시간</label>
                <input 
                  type="time" 
                  value={visitTime}
                  onChange={(e) => setVisitTime(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 transition-shadow"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!isSearchingAddress && (
          <div className="p-5 border-t border-slate-100">
            <button 
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full py-4 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-lg shadow-teal-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? '저장 중...' : '저장하기'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
