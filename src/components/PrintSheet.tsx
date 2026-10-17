'use client';

import { forwardRef } from 'react';
import { IconUser } from '@tabler/icons-react';

interface SheetRecipient {
  id: string;
  name: string;
  photo_url?: string | null;
  age?: number | null;
  care_grade?: string | null;
}

interface PrintSheetProps {
  recipient: SheetRecipient;
  healthStatus: string;
  onHealthStatusChange: (value: string) => void;
  memo: string;
  onMemoChange: (value: string) => void;
  writtenDate: string;
  onWrittenDateChange: (value: string) => void;
  authorName: string;
  onAuthorNameChange: (value: string) => void;
}

function formatWrittenDate(value: string): string {
  if (!value) return '';
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return value;
  return `${y}년 ${m}월 ${d}일`;
}

const textFieldClass =
  'print-edit-only w-full p-3 bg-surface border border-surface-border/60 rounded-[16px] text-[13px] font-bold outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-foreground/30 text-foreground';

// 어르신 정보 출력/PDF 저장 한 장의 레이아웃. 화면에서는 수기 입력란(textarea/input)을 보여주고,
// 인쇄·PDF 캡처 시에는 .print-edit-only를 숨기고 .print-only 텍스트로 대체해 내용이 잘리지 않게 한다.
const PrintSheet = forwardRef<HTMLDivElement, PrintSheetProps>(function PrintSheet(
  { recipient, healthStatus, onHealthStatusChange, memo, onMemoChange, writtenDate, onWrittenDateChange, authorName, onAuthorNameChange },
  ref
) {
  return (
    <div ref={ref} className="print-sheet flex flex-col gap-4">
      {/* 1. 사진 + 이름/나이/등급: 등록된 정보를 그대로 보여준다 */}
      <div className="bg-foreground/[0.03] dark:bg-white/[0.04] p-5 rounded-[26px] border border-surface-border/40 flex items-center gap-4">
        <div className="w-24 h-24 rounded-[22px] overflow-hidden bg-primary/5 border border-surface-border/60 flex items-center justify-center shrink-0">
          {recipient.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={recipient.photo_url} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" />
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

      {/* 2. 주요 건강 상태: 수기 입력란. 인쇄/PDF 시 A4 한 장을 채우도록 늘어남 */}
      <div className="print-grow flex flex-col gap-1.5">
        <span className="text-[13px] font-black text-primary tracking-tight pl-1">어르신 주요 건강 상태</span>
        <textarea
          value={healthStatus}
          onChange={(e) => onHealthStatusChange(e.target.value)}
          placeholder="예: 고혈압, 경증 치매로 복약 지도 필요"
          className="print-edit-only w-full h-48 p-4 bg-surface border border-surface-border/60 rounded-[20px] text-[14px] font-bold leading-relaxed outline-none focus:ring-2 focus:ring-primary/30 resize-none placeholder:text-foreground/30 text-foreground"
        />
        {/* 인쇄/PDF 시에는 textarea 스크롤 영역 대신 전체 내용이 보이는 텍스트로 대체 */}
        <div className="print-only p-4 border border-foreground/30 rounded-[20px] text-[14px] font-bold leading-relaxed whitespace-pre-wrap">
          {healthStatus || ' '}
        </div>
      </div>

      {/* 3. 참고 (메모용): 수기 입력란. 인쇄/PDF 시 A4 한 장을 채우도록 늘어남 */}
      <div className="print-grow flex flex-col gap-1.5">
        <span className="text-[13px] font-black text-primary tracking-tight pl-1">참고 (메모용)</span>
        <textarea
          value={memo}
          onChange={(e) => onMemoChange(e.target.value)}
          placeholder="그 외 전달할 특이사항을 자유롭게 적어주세요"
          className="print-edit-only w-full h-48 p-4 bg-surface border border-surface-border/60 rounded-[20px] text-[14px] font-bold leading-relaxed outline-none focus:ring-2 focus:ring-primary/30 resize-none placeholder:text-foreground/30 text-foreground"
        />
        <div className="print-only p-4 border border-foreground/30 rounded-[20px] text-[14px] font-bold leading-relaxed whitespace-pre-wrap">
          {memo || ' '}
        </div>
      </div>

      {/* 4. 작성일 / 작성자 (선택): 필수 아님, 비워두면 빈 줄로 출력됨 */}
      <div className="flex gap-3">
        <div className="flex-1 flex flex-col gap-1.5">
          <span className="text-[12px] font-black text-foreground/50 pl-1">작성일 (선택)</span>
          <input
            type="date"
            value={writtenDate}
            onChange={(e) => onWrittenDateChange(e.target.value)}
            className={textFieldClass}
          />
          <div className="print-only p-3 border border-foreground/30 rounded-[16px] text-[13px] font-bold">
            {formatWrittenDate(writtenDate) || ' '}
          </div>
        </div>
        <div className="flex-1 flex flex-col gap-1.5">
          <span className="text-[12px] font-black text-foreground/50 pl-1">작성자 (선택)</span>
          <input
            type="text"
            value={authorName}
            onChange={(e) => onAuthorNameChange(e.target.value)}
            placeholder="예: 홍길동 요양보호사"
            className={textFieldClass}
          />
          <div className="print-only p-3 border border-foreground/30 rounded-[16px] text-[13px] font-bold">
            {authorName || ' '}
          </div>
        </div>
      </div>
    </div>
  );
});

export default PrintSheet;
