import React, { useState, useMemo } from 'react';
import { Modal, IconButton } from '@/components/ui';
import { IconX, IconSearch, IconUser, IconPlus, IconCheck } from '@tabler/icons-react';
import { supabase } from '@/lib/supabase';

// Assuming Recipient type is globally available or we duplicate its slim version
interface Recipient {
  id: string;
  name: string;
  address: string;
  photo_url?: string | null;
  notes?: string | null;
  recurring_weekdays?: string | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  date: Date;
  allRecipients: Recipient[];
  onSuccess: () => void;
  onSelectRecipient: (r: Recipient) => void;
}

export default function ScheduleAddModal({ isOpen, onClose, date, allRecipients, onSelectRecipient }: Props) {
  const [search, setSearch] = useState('');
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const ymd = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  const getScheduledForDate = (r: Recipient) => {
    if (r.notes && r.notes.includes(ymd)) return true;
    if (r.recurring_weekdays) {
      return r.recurring_weekdays.split(',').map(Number).includes(date.getDay());
    }
    return false;
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRecipients.filter(r => 
      !getScheduledForDate(r) && 
      (!q || r.name.toLowerCase().includes(q) || (r.address && r.address.toLowerCase().includes(q)))
    );
  }, [allRecipients, search, date]);

  const handleAdd = (r: Recipient) => {
    onClose();
    onSelectRecipient(r);
  };

  return (
    <Modal open={isOpen} onClose={onClose}>
      <div className="flex items-center justify-between p-6 border-b border-surface-border/60">
        <div>
          <h2 className="text-xl font-black text-foreground tracking-tight">방문 일정 추가</h2>
          <p className="text-xs font-semibold text-foreground/50 mt-0.5">
            {date.getFullYear()}년 {date.getMonth() + 1}월 {date.getDate()}일 방문할 어르신을 선택하세요
          </p>
        </div>
        <IconButton onClick={onClose} className="rounded-[18px] bg-foreground/[0.04] hover:bg-foreground/[0.08]" aria-label="닫기">
          <IconX size={20} />
        </IconButton>
      </div>
      
      <div className="p-4 pb-2">
        <div className="relative">
          <IconSearch size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/40" />
          <input 
            type="text"
            className="w-full pl-11 pr-4 py-3.5 bg-foreground/[0.03] dark:bg-white/[0.04] border border-surface-border/60 rounded-[20px] outline-none focus:ring-2 focus:ring-primary/30 transition-all text-foreground text-sm font-bold placeholder:text-foreground/35"
            placeholder="어르신 성함 또는 주소 검색..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-y-auto max-h-[55vh] px-4 pb-5 space-y-2.5">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-foreground/45 text-sm font-bold flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-[18px] bg-foreground/[0.03] flex items-center justify-center mb-2 text-foreground/30">
              <IconUser size={24} />
            </div>
            {search ? '검색된 어르신이 없습니다.' : '해당 날짜에 추가할 수 있는 어르신이 없습니다.'}
          </div>
        ) : (
          filtered.map(r => (
            <div 
              key={r.id} 
              onClick={() => handleAdd(r)}
              className="flex items-center justify-between p-3.5 rounded-[22px] bg-surface/90 hover:bg-foreground/[0.03] dark:hover:bg-white/[0.04] border border-surface-border/50 transition-all cursor-pointer active:scale-[0.98] shadow-2xs"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-[18px] bg-primary/5 flex items-center justify-center shrink-0 overflow-hidden border border-surface-border/40 shadow-2xs">
                  {r.photo_url ? (
                    <img src={r.photo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <IconUser size={24} className="text-primary" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-black text-foreground text-[16px] tracking-tight truncate">{r.name} 어르신</p>
                  <p className="text-xs text-foreground/50 font-semibold truncate leading-relaxed max-w-[200px]">{r.address}</p>
                </div>
              </div>
              
              <button 
                type="button"
                onClick={(e) => { e.stopPropagation(); handleAdd(r); }}
                className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground hover:opacity-90 shadow-sm transition-all active:scale-90 shrink-0 ml-2"
                aria-label="선택 및 시간 설정"
              >
                <IconPlus size={20} strokeWidth={2.5} />
              </button>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}
