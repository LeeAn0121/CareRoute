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
  'print-edit-only w-full p-3 bg-surface border border-[#d8d8dc] rounded-[16px] text-[13px] font-bold outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-foreground/30 text-foreground';

// 어르신 정보 출력/PDF 저장 한 장의 레이아웃. 화면에서는 수기 입력란(textarea/input)을 보여주고,
// 인쇄·PDF 캡처 시에는 .print-edit-only를 숨기고 .print-only 텍스트로 대체해 내용이 잘리지 않게 한다.
// html2canvas는 display:none인 요소라도 그 요소 자신의 색상 스타일은 먼저 파싱한 뒤에야 "안 보이니
// 건너뛴다"고 판단한다. 그래서 .print-edit-only로 숨기는 요소 자신에게 /NN 투명도가 섞인 테마
// 색상 클래스(Tailwind v4가 color-mix()로 컴파일)를 직접 주면, 숨겨져 있어도 캡처 시점에
// "Attempting to parse an unsupported color function" 오류로 PDF 생성이 실패한다(실제 보고된 원인).
// border-surface-border/60 처럼 요소 자신에게 직접 붙던 투명도 클래스는 전부 고정 hex로 대체했다.
// (focus:/placeholder: 처럼 가상 클래스·요소에 걸리는 투명도는 기본 computed style에 안 잡혀 안전하다.)
const PrintSheet = forwardRef<HTMLDivElement, PrintSheetProps>(function PrintSheet(
  { recipient, healthStatus, onHealthStatusChange, memo, onMemoChange, writtenDate, onWrittenDateChange, authorName, onAuthorNameChange },
  ref
) {
  return (
    <div ref={ref} className="print-sheet flex flex-col gap-4">
      {/* 1. 사진 + 이름/나이/등급: 등록된 정보를 그대로 보여준다 */}
      <div className="bg-[#f7f7f8] p-5 rounded-[26px] border border-[#e5e5ea] flex items-center gap-4">
        <div className="w-24 h-24 rounded-[22px] overflow-hidden bg-[#f4f4f5] border border-[#e5e5ea] flex items-center justify-center shrink-0">
          {recipient.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={recipient.photo_url} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" />
          ) : (
            <IconUser size={36} className="text-[#bcbcc0]" />
          )}
        </div>
        <div className="flex flex-col gap-1.5 min-w-0">
          <p className="text-[22px] leading-[1.4] font-black text-[#1c1c1e] tracking-tight break-words">{recipient.name} 어르신</p>
          <p className="text-[14px] font-bold text-[#616165]">
            나이 <span className="text-[#1c1c1e]">{recipient.age != null ? `${recipient.age}세` : '미입력'}</span>
          </p>
          <p className="text-[14px] font-bold text-[#616165]">
            등급 <span className="text-[#1c1c1e]">{recipient.care_grade || '미입력'}</span>
          </p>
        </div>
      </div>

      {/* 2. 주요 건강 상태: 수기 입력란. 인쇄/PDF 시 A4 한 장을 채우도록 늘어남 */}
      <div className="print-grow flex flex-col gap-1.5">
        <span className="text-[17px] font-black text-[#1c1c1e] tracking-tight pl-1">어르신 주요 건강 상태</span>
        <textarea
          value={healthStatus}
          onChange={(e) => onHealthStatusChange(e.target.value)}
          placeholder="예: 고혈압, 경증 치매로 복약 지도 필요"
          className="print-edit-only w-full h-48 p-4 bg-surface border border-[#d8d8dc] rounded-[20px] text-[14px] font-bold leading-relaxed outline-none focus:ring-2 focus:ring-primary/30 resize-none placeholder:text-foreground/30 text-foreground"
        />
        {/* 인쇄/PDF 시에는 textarea 스크롤 영역 대신 전체 내용이 보이는 텍스트로 대체 */}
        <div className="print-only p-4 border border-[#c7c7cc] rounded-[20px] text-[14px] font-bold leading-relaxed whitespace-pre-wrap text-[#1c1c1e]">
          {healthStatus || ' '}
        </div>
      </div>

      {/* 3. 참고 (메모용): 수기 입력란. 인쇄/PDF 시 A4 한 장을 채우도록 늘어남 */}
      <div className="print-grow flex flex-col gap-1.5">
        <span className="text-[17px] font-black text-[#1c1c1e] tracking-tight pl-1">참고 (메모용)</span>
        <textarea
          value={memo}
          onChange={(e) => onMemoChange(e.target.value)}
          placeholder="그 외 전달할 특이사항을 자유롭게 적어주세요"
          className="print-edit-only w-full h-48 p-4 bg-surface border border-[#d8d8dc] rounded-[20px] text-[14px] font-bold leading-relaxed outline-none focus:ring-2 focus:ring-primary/30 resize-none placeholder:text-foreground/30 text-foreground"
        />
        <div className="print-only p-4 border border-[#c7c7cc] rounded-[20px] text-[14px] font-bold leading-relaxed whitespace-pre-wrap text-[#1c1c1e]">
          {memo || ' '}
        </div>
      </div>

      {/* 4. 작성일 / 작성자: 완전히 선택 입력. 화면에서는 항상 입력할 수 있게 보여주지만,
          인쇄/PDF에는 실제로 값을 채운 항목만 나가고 비워둔 항목은 아예 나타나지 않는다. */}
      <div className="print-edit-only flex gap-3">
        <div className="flex-1 flex flex-col gap-1.5">
          <span className="text-[12px] font-black text-foreground/50 pl-1">작성일 (선택)</span>
          <input
            type="date"
            value={writtenDate}
            onChange={(e) => onWrittenDateChange(e.target.value)}
            className={textFieldClass}
          />
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
        </div>
      </div>

      {(writtenDate || authorName) && (
        <div className="print-only print-row flex gap-3">
          {writtenDate && (
            <div className={`p-3 border border-[#c7c7cc] rounded-[16px] text-[13px] font-bold text-[#1c1c1e] ${authorName ? 'flex-1' : 'w-full'}`}>
              <span className="block text-[13px] font-black text-[#8e8e93] mb-0.5">작성일</span>
              {formatWrittenDate(writtenDate)}
            </div>
          )}
          {authorName && (
            <div className={`p-3 border border-[#c7c7cc] rounded-[16px] text-[13px] font-bold text-[#1c1c1e] ${writtenDate ? 'flex-1' : 'w-full'}`}>
              <span className="block text-[13px] font-black text-[#8e8e93] mb-0.5">작성자</span>
              {authorName}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default PrintSheet;
