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
}

export default function ScheduleAddModal({ isOpen, onClose, date, allRecipients, onSuccess }: Props) {
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
    return allRecipients.filter(r => 
      !getScheduledForDate(r) && 
      r.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [allRecipients, search, date]);

  const handleAdd = async (r: Recipient) => {
    setLoadingId(r.id);
    try {
      // Append the date to notes (which we are using to store specific dates)
      const existingDates = r.notes ? r.notes.split(',').map(s => s.trim()).filter(Boolean) : [];
      if (!existingDates.includes(ymd)) {
        existingDates.push(ymd);
      }
      const newNotes = existingDates.join(',');

      const { error } = await supabase.from('recipients').update({ notes: newNotes }).eq('id', r.id);
      if (error) throw error;
      
      onSuccess();
    } catch (e) {
      console.error(e);
      alert('일정 추가 중 오류가 발생했습니다.');
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <Modal open={isOpen} onClose={onClose}>
      <div className="flex items-center justify-between p-5 border-b border-surface-border">
        <div>
          <h2 className="text-xl font-black text-primary tracking-tight">일정 추가</h2>
          <p className="text-sm font-semibold text-foreground/50">{date.getMonth() + 1}월 {date.getDate()}일 방문할 어르신을 선택하세요.</p>
        </div>
        <IconButton onClick={onClose} className="bg-surface-muted hover:bg-surface-border">
          <IconX size={20} />
        </IconButton>
      </div>
      
      <div className="p-4">
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            <IconSearch size={18} className="text-foreground/40" />
          </div>
          <input 
            type="text"
            className="w-full pl-10 pr-4 py-3 bg-surface border border-surface-border rounded-xl outline-none focus:border-primary transition-colors text-foreground"
            placeholder="어르신 이름 검색..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-y-auto max-h-[50vh] px-2 pb-4 space-y-2">
        {filtered.length === 0 ? (
          <div className="py-8 text-center text-foreground/50 text-sm font-semibold">
            추가할 수 있는 어르신이 없습니다.
          </div>
        ) : (
          filtered.map(r => (
            <div key={r.id} className="flex items-center justify-between p-3 rounded-2xl hover:bg-surface-muted transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden">
                  {r.photo_url ? <img src={r.photo_url} alt="" className="w-full h-full object-cover" /> : <IconUser size={20} className="text-primary" />}
                </div>
                <div>
                  <p className="font-bold text-foreground text-base">{r.name}</p>
                  <p className="text-xs text-foreground/50 truncate max-w-[150px]">{r.address}</p>
                </div>
              </div>
              <button 
                onClick={() => handleAdd(r)}
                disabled={loadingId === r.id}
                className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
              >
                {loadingId === r.id ? <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <IconPlus size={20} strokeWidth={2.5} />}
              </button>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}
