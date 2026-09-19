'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useDaumPostcodePopup } from 'react-daum-postcode';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  IconButton,
  CircularProgress
} from '@mui/material';
import { IconX, IconSearch, IconMapPin } from '@tabler/icons-react';

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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openPostcode = useDaumPostcodePopup('https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js');

  useEffect(() => {
    if (isOpen) {
      if (recipientToEdit) {
        setName(recipientToEdit.name);
        setAddress(recipientToEdit.address);
        setDetailAddress('');
        setBcode(recipientToEdit.dong);
        setVisitTime(recipientToEdit.visit_time.substring(0, 5));
        setVisitDate(recipientToEdit.notes || '');
      } else {
        setName('');
        setAddress('');
        setDetailAddress('');
        setBcode('');
        setVisitTime('');
        setVisitDate('');
      }
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
  };

  const handleSearchAddress = () => {
    openPostcode({ onComplete: handleComplete });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !address || !bcode || !visitDate || !visitTime) {
      alert('모든 필수 항목을 입력해주세요.');
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
          console.warn('Geocoding completely failed. Using default coords to prevent blocking save.', e);
          // Don't block save, just use default/0,0 or existing
          if (recipientToEdit) {
             coords = { lat: recipientToEdit.lat, lng: recipientToEdit.lng };
          }
        }
      }

      const finalAddress = detailAddress ? `${address} ${detailAddress}` : address;

      const recipientData = {
        name,
        address: finalAddress,
        sido: bcode.substring(0, 2) + '00000000',
        sigungu: bcode.substring(0, 5) + '00000',
        dong: bcode,
        lat: coords.lat,
        lng: coords.lng,
        visit_time: visitTime + ':00',
        notes: visitDate
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
    <Dialog open={isOpen} onClose={!isSubmitting ? onClose : undefined} fullWidth maxWidth="sm" sx={{ '& .MuiDialog-paper': { borderRadius: 4, p: 1 } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          {recipientToEdit ? '어르신 정보 수정' : '새 어르신 등록'}
        </Typography>
        <IconButton onClick={onClose} disabled={isSubmitting}>
          <IconX />
        </IconButton>
      </DialogTitle>
      
      <DialogContent>
        <Box component="form" id="recipient-form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
          <TextField
            label="성함"
            variant="outlined"
            fullWidth
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSubmitting}
            
          />
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              label="기본 주소"
              variant="outlined"
              fullWidth
              required
              value={address}
              disabled
              
            />
            <Button 
              variant="contained" 
              color="primary" 
              onClick={handleSearchAddress}
              disabled={isSubmitting}
              sx={{ borderRadius: 3, px: 3, boxShadow: 'none' }}
              startIcon={<IconSearch size={18} />}
            >
              검색
            </Button>
          </Box>
          
          <TextField
            label="상세 주소 (선택)"
            variant="outlined"
            fullWidth
            value={detailAddress}
            onChange={(e) => setDetailAddress(e.target.value)}
            disabled={isSubmitting}
            
          />

          <TextField
            label="방문 예정 시간"
            type="time"
            variant="outlined"
            fullWidth
            required
            value={visitTime}
            onChange={(e) => setVisitTime(e.target.value)}
            disabled={isSubmitting}
            
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Box>
      </DialogContent>
      
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button 
          type="submit" 
          form="recipient-form"
          variant="contained" 
          fullWidth 
          size="large"
          disabled={isSubmitting}
          sx={{ borderRadius: 3, py: 1.5, fontSize: '1.1rem', fontWeight: 700, boxShadow: 'none' }}
        >
          {isSubmitting ? <CircularProgress size={24} color="inherit" /> : '저장하기'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
