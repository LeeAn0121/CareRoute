'use client';

import { forwardRef, useState } from 'react';
import { IconUser } from '@tabler/icons-react';
import { parseVisitTime } from '@/lib/visitTime';

interface SheetRecipient {
  id: string;
  name: string;
  photo_url?: string | null;
  age?: number | null;
  care_grade?: string | null;
  health_tags?: string | null;
  visit_time?: string | null;
  notes?: string | null;
  door_passcode?: string | null;
  parking_memo?: string | null;
}

interface PrintSheetProps {
  recipient: SheetRecipient;
  scheduleLabel?: string;
  healthStatus: string;
  onHealthStatusChange: (value: string) => void;
  memo: string;
  onMemoChange: (value: string) => void;
  writtenDate: string;
  onWrittenDateChange: (value: string) => void;
  authorName: string;
  onAuthorNameChange: (value: string) => void;
  confirmerName: string;
  onConfirmerNameChange: (value: string) => void;
  orgName: string;
  onOrgNameChange: (value: string) => void;
  orgContact: string;
  onOrgContactChange: (value: string) => void;
}

function formatWrittenDate(value: string): string {
  if (!value) return '';
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return value;
  return `${y}년 ${m}월 ${d}일`;
}

function appendPhrase(current: string, phrase: string): string {
  return current.trim() ? `${current}\n${phrase}` : phrase;
}

const DEFAULT_HEALTH_PHRASES = ['정기 혈압 체크 필요', '복약 지도 필요', '식이 조절 필요', '욕창 예방 관찰'];
const MEMO_PHRASES = ['가족 연락 완료', '병원 진료 예정', '추가 방문 예정', '응급 연락처 확인 필요'];

const textFieldClass =
  'print-edit-only w-full p-3 bg-surface border border-[#d8d8dc] rounded-[16px] text-[13px] font-bold outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-foreground/30 text-foreground';

function QuickPhraseChips({ phrases, onPick }: { phrases: string[]; onPick: (phrase: string) => void }) {
  if (phrases.length === 0) return null;
  return (
    <div className="print-edit-only flex flex-wrap gap-1.5">
      {phrases.map((phrase) => (
        <button
          key={phrase}
          type="button"
          onClick={() => onPick(phrase)}
          className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-foreground/[0.04] hover:bg-foreground/[0.08] text-foreground/65 border border-surface-border/50 active:scale-95 transition-all"
        >
          + {phrase}
        </button>
      ))}
    </div>
  );
}

// 어르신 정보 출력/PDF 저장 한 장의 레이아웃. 화면에서는 수기 입력란(textarea/input)을 보여주고,
// 인쇄·PDF 캡처 시에는 .print-edit-only를 숨기고 .print-only 텍스트로 대체해 내용이 잘리지 않게 한다.
// html2canvas는 display:none인 요소라도 그 요소 자신의 색상 스타일은 먼저 파싱한 뒤에야 "안 보이니
// 건너뛴다"고 판단한다. 그래서 .print-edit-only로 숨기는 요소 자신에게 /NN 투명도가 섞인 테마
// 색상 클래스(Tailwind v4가 color-mix()로 컴파일)를 직접 주면, 숨겨져 있어도 캡처 시점에
// "Attempting to parse an unsupported color function" 오류로 PDF 생성이 실패한다(실제 보고된 원인).
// border-surface-border/60 처럼 요소 자신에게 직접 붙던 투명도 클래스는 전부 고정 hex로 대체했다.
// (focus:/placeholder: 처럼 가상 클래스·요소에 걸리는 투명도는 기본 computed style에 안 잡혀 안전하다.)
const PrintSheet = forwardRef<HTMLDivElement, PrintSheetProps>(function PrintSheet(
  {
    recipient,
    scheduleLabel,
    healthStatus,
    onHealthStatusChange,
    memo,
    onMemoChange,
    writtenDate,
    onWrittenDateChange,
    authorName,
    onAuthorNameChange,
    confirmerName,
    onConfirmerNameChange,
    orgName,
    onOrgNameChange,
    orgContact,
    onOrgContactChange,
  },
  ref
) {
  const healthPhrases = [
    ...(recipient.health_tags ? recipient.health_tags.split(',').filter(Boolean) : []),
    ...DEFAULT_HEALTH_PHRASES,
  ];
  const infoFieldCount = [writtenDate, authorName, confirmerName].filter(Boolean).length;
  const infoCellClass = infoFieldCount > 1 ? 'flex-1' : 'w-full';
  const visitTimeInfo = parseVisitTime(recipient.visit_time, recipient.notes);
  const hasVisitInfo = visitTimeInfo.hasTime || Boolean(recipient.door_passcode) || Boolean(recipient.parking_memo);
  // 공동현관 비번 등 민감 정보가 섞여 있어 기본값은 미포함으로 둔다(명시적으로 체크해야 출력물에 실린다).
  const [includeVisitInfo, setIncludeVisitInfo] = useState(false);

  return (
    <div ref={ref} className="print-sheet flex flex-col gap-4">
      {/* -1. 주간 일괄 출력 시 어느 날짜 방문인지 구분하는 배너(단일/일별 출력에는 없음) */}
      {scheduleLabel && (
        <div className="print-only text-[15px] font-black text-[#1c1c1e] -mb-2">
          {scheduleLabel}
        </div>
      )}

      {/* 0. 기관 정보(선택): 기관명/연락처를 채워두면 모든 출력물 상단에 자동으로 함께 찍힌다 */}
      <div className="print-edit-only flex gap-3">
        <div className="flex-1 flex flex-col gap-1.5">
          <span className="text-[12px] font-black text-foreground/50 pl-1">기관명 (선택)</span>
          <input
            type="text"
            value={orgName}
            onChange={(e) => onOrgNameChange(e.target.value)}
            placeholder="예: 행복 재가복지센터"
            className={textFieldClass}
          />
        </div>
        <div className="flex-1 flex flex-col gap-1.5">
          <span className="text-[12px] font-black text-foreground/50 pl-1">연락처 (선택)</span>
          <input
            type="text"
            value={orgContact}
            onChange={(e) => onOrgContactChange(e.target.value)}
            placeholder="예: 02-1234-5678"
            className={textFieldClass}
          />
        </div>
      </div>
      {(orgName || orgContact) && (
        <div className="print-only text-[12px] font-bold text-[#8e8e93] -mb-2">
          {[orgName, orgContact].filter(Boolean).join(' · ')}
        </div>
      )}

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

      {/* 1.5 방문 정보(선택): 그날 방문 시간/공동현관 비번/주차 메모. 비번처럼 민감한 정보가
          섞여 있어 기본은 미포함이며, 체크해야 출력물에 함께 실린다. */}
      {hasVisitInfo && (
        <label className="print-edit-only -mt-2 flex items-center gap-2 pl-1 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeVisitInfo}
            onChange={(e) => setIncludeVisitInfo(e.target.checked)}
            className="w-4 h-4 rounded accent-primary"
          />
          <span className="text-[12px] font-bold text-foreground/60">방문 시간·공동현관 비번·주차 메모 포함</span>
        </label>
      )}
      {includeVisitInfo && hasVisitInfo && (
        <div className="print-only text-[13px] font-bold text-[#1c1c1e] flex flex-wrap gap-x-4 gap-y-1 -mb-2">
          {visitTimeInfo.hasTime && (
            <span>방문 시간 <span className="text-[#616165]">{visitTimeInfo.formattedText}</span></span>
          )}
          {recipient.door_passcode && (
            <span>공동현관 비번 <span className="text-[#616165]">{recipient.door_passcode}</span></span>
          )}
          {recipient.parking_memo && (
            <span>주차 <span className="text-[#616165]">{recipient.parking_memo}</span></span>
          )}
        </div>
      )}

      {/* 2. 주요 건강 상태: 수기 입력란. 인쇄/PDF 시 A4 한 장을 채우도록 늘어남 */}
      <div className="print-grow flex flex-col gap-1.5">
        <span className="text-[17px] font-black text-[#1c1c1e] tracking-tight pl-1">어르신 주요 건강 상태</span>
        <QuickPhraseChips phrases={healthPhrases} onPick={(p) => onHealthStatusChange(appendPhrase(healthStatus, p))} />
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
        <QuickPhraseChips phrases={MEMO_PHRASES} onPick={(p) => onMemoChange(appendPhrase(memo, p))} />
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

      {/* 4. 작성일 / 작성자 / 확인자(서명): 전부 선택 입력. 화면에서는 항상 입력할 수 있게 보여주지만,
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
        <div className="flex-1 flex flex-col gap-1.5">
          <span className="text-[12px] font-black text-foreground/50 pl-1">확인자 (선택)</span>
          <input
            type="text"
            value={confirmerName}
            onChange={(e) => onConfirmerNameChange(e.target.value)}
            placeholder="인수인계 확인자"
            className={textFieldClass}
          />
        </div>
      </div>

      {(writtenDate || authorName || confirmerName) && (
        <div className="print-only print-row flex gap-3">
          {writtenDate && (
            <div className={`p-3 border border-[#c7c7cc] rounded-[16px] text-[13px] font-bold text-[#1c1c1e] ${infoCellClass}`}>
              <span className="block text-[13px] font-black text-[#8e8e93] mb-0.5">작성일</span>
              {formatWrittenDate(writtenDate)}
            </div>
          )}
          {authorName && (
            <div className={`p-3 border border-[#c7c7cc] rounded-[16px] text-[13px] font-bold text-[#1c1c1e] ${infoCellClass}`}>
              <span className="block text-[13px] font-black text-[#8e8e93] mb-0.5">작성자</span>
              {authorName}
            </div>
          )}
          {confirmerName && (
            <div className={`p-3 border border-[#c7c7cc] rounded-[16px] text-[13px] font-bold text-[#1c1c1e] ${infoCellClass}`}>
              <span className="block text-[13px] font-black text-[#8e8e93] mb-0.5">확인자</span>
              {confirmerName}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default PrintSheet;
