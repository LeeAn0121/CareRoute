'use client';

import { useState, useEffect } from 'react';
import { IconX, IconPrinter, IconUser } from '@tabler/icons-react';
import { Modal, IconButton, Button } from './ui';

interface Recipient {
  id: string;
  name: string;
  photo_url?: string | null;
  age?: number | null;
  care_grade?: string | null;
}

interface PrintProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipient: Recipient | null;
}

export default function PrintProfileModal({ isOpen, onClose, recipient }: PrintProfileModalProps) {
  const [healthStatus, setHealthStatus] = useState('');
  const [memo, setMemo] = useState('');

  // 어르신별로 작성 중이던 내용을 기억해뒀다가 다음에 출력할 때 이어서 쓸 수 있게 한다.
  useEffect(() => {
    if (isOpen && recipient && typeof window !== 'undefined') {
      setHealthStatus(localStorage.getItem(`careroute_print_health_${recipient.id}`) || '');
      setMemo(localStorage.getItem(`careroute_print_memo_${recipient.id}`) || '');
    }
  }, [isOpen, recipient]);

  useEffect(() => {
    if (!recipient || typeof window === 'undefined') return;
    if (healthStatus) localStorage.setItem(`careroute_print_health_${recipient.id}`, healthStatus);
    else localStorage.removeItem(`careroute_print_health_${recipient.id}`);
  }, [healthStatus, recipient]);

  useEffect(() => {
    if (!recipient || typeof window === 'undefined') return;
    if (memo) localStorage.setItem(`careroute_print_memo_${recipient.id}`, memo);
    else localStorage.removeItem(`careroute_print_memo_${recipient.id}`);
  }, [memo, recipient]);

  if (!recipient) return null;

  return (
    <Modal open={isOpen} onClose={onClose}>
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 px-5 sm:px-6 pt-4 sm:pt-6 pb-3 bg-surface">
        <div className="min-w-0">
          <h2 className="text-[20px] font-black text-foreground tracking-tight">어르신 정보 출력</h2>
          <p className="text-[12px] font-bold text-foreground/50">내용을 채운 뒤 인쇄 버튼을 눌러주세요</p>
        </div>
        <IconButton onClick={onClose} className="shrink-0 w-9 h-9 rounded-full bg-foreground/[0.04] hover:bg-foreground/[0.08]" aria-label="닫기">
          <IconX size={18} />
        </IconButton>
      </div>

      <div id="print-sheet" className="px-5 sm:px-6 py-3 flex flex-col gap-4">
        {/* 1. 사진 + 이름/나이/등급: 등록된 정보를 그대로 보여준다 */}
        <div className="bg-foreground/[0.03] dark:bg-white/[0.04] p-5 rounded-[26px] border border-surface-border/40 flex items-center gap-4">
          <div className="w-24 h-24 rounded-[22px] overflow-hidden bg-primary/5 border border-surface-border/60 flex items-center justify-center shrink-0">
            {recipient.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={recipient.photo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <IconUser size={36} className="text-foreground/30" />
            )}
          </div>
          <div className="flex flex-col gap-1.5 min-w-0">
            <p className="text-[22px] font-black text-foreground tracking-tight truncate">{recipient.name} 어르신</p>
            <p className="text-[14px] font-bold text-foreground/70">
              나이 <span className="text-foreground">{recipient.age != null ? `${recipient.age}세` : '미입력'}</span>
            </p>
            <p className="text-[14px] font-bold text-foreground/70">
              등급 <span className="text-foreground">{recipient.care_grade || '미입력'}</span>
            </p>
          </div>
        </div>

        {/* 2. 주요 건강 상태: 수기 입력란. 인쇄 시 A4 한 장을 채우도록 늘어남 */}
        <div className="print-grow flex flex-col gap-1.5">
          <span className="text-[13px] font-black text-primary tracking-tight pl-1">어르신 주요 건강 상태</span>
          <textarea
            value={healthStatus}
            onChange={(e) => setHealthStatus(e.target.value)}
            placeholder="예: 고혈압, 경증 치매로 복약 지도 필요"
            className="print-edit-only w-full h-48 p-4 bg-surface border border-surface-border/60 rounded-[20px] text-[14px] font-bold leading-relaxed outline-none focus:ring-2 focus:ring-primary/30 resize-none placeholder:text-foreground/30 text-foreground"
          />
          {/* 인쇄 시에는 textarea 스크롤 영역 대신 전체 내용이 보이는 텍스트로 대체 */}
          <div className="print-only p-4 border border-foreground/30 rounded-[20px] text-[14px] font-bold leading-relaxed whitespace-pre-wrap">
            {healthStatus || ' '}
          </div>
        </div>

        {/* 3. 참고 (메모용): 수기 입력란. 인쇄 시 A4 한 장을 채우도록 늘어남 */}
        <div className="print-grow flex flex-col gap-1.5">
          <span className="text-[13px] font-black text-primary tracking-tight pl-1">참고 (메모용)</span>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="그 외 전달할 특이사항을 자유롭게 적어주세요"
            className="print-edit-only w-full h-48 p-4 bg-surface border border-surface-border/60 rounded-[20px] text-[14px] font-bold leading-relaxed outline-none focus:ring-2 focus:ring-primary/30 resize-none placeholder:text-foreground/30 text-foreground"
          />
          <div className="print-only p-4 border border-foreground/30 rounded-[20px] text-[14px] font-bold leading-relaxed whitespace-pre-wrap">
            {memo || ' '}
          </div>
        </div>
      </div>

      <div className="no-print sticky bottom-0 z-10 px-5 sm:px-6 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] bg-surface/95 supports-[backdrop-filter]:bg-surface/85 backdrop-blur-xl border-t border-surface-border/40">
        <Button
          type="button"
          fullWidth
          startIcon={<IconPrinter size={19} />}
          onClick={() => window.print()}
          className="whitespace-nowrap py-3.5 text-[16px] font-black rounded-[22px] shadow-lg shadow-primary/20"
        >
          인쇄하기
        </Button>
      </div>
    </Modal>
  );
}
