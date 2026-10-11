'use client';
import { useState, useMemo } from 'react';
import { Modal, IconButton, Button } from '@/components/ui';
import { 
  IconX, 
  IconShare, 
  IconCopy, 
  IconCheck, 
  IconMessageCircle, 
  IconHeart, 
  IconClock, 
  IconMapPin, 
  IconUser,
  IconShieldCheck
} from '@tabler/icons-react';

interface Recipient {
  id: string;
  name: string;
  address: string;
  detail_address?: string | null;
  visit_time?: string;
  notes?: string | null;
  last_completed_memo?: string | null;
  health_tags?: string | null;
}

interface ShareReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipient: Recipient | null;
  selectedDate?: Date | null;
}

const CARE_TAG_PRESETS = [
  '식사 지원 완료',
  '투약 확인 완료',
  '건강/혈압 측정 완료',
  '실내 청결 및 환기',
  '안부 확인 및 말벗',
  '보행/산책 보조',
  '특이사항 없음'
];

export default function ShareReportModal({
  isOpen,
  onClose,
  recipient,
  selectedDate
}: ShareReportModalProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>(['식사 지원 완료', '투약 확인 완료']);
  const [customMemo, setCustomMemo] = useState('');
  const [copied, setCopied] = useState(false);

  // 날짜 및 시간 계산
  const targetDate = selectedDate || new Date();
  const dateStr = `${targetDate.getFullYear()}년 ${targetDate.getMonth() + 1}월 ${targetDate.getDate()}일`;
  const timeNow = `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  // 모달 열릴 때 초기 메모 설정
  const memoText = customMemo !== '' ? customMemo : (recipient?.last_completed_memo || '');

  // 안심 알림 공유용 서식 텍스트 생성
  const shareText = useMemo(() => {
    if (!recipient) return '';
    const lines = [
      `[케어루트 안심 알림 💙]`,
      `안녕하세요! 오늘 ${recipient.name} 어르신 댁 방문 요양 케어를 안전하게 마쳤습니다.`,
      ``,
      `📅 방문 일시: ${dateStr} (${timeNow} 완료)`,
      `📍 방문 장소: ${recipient.address}${recipient.detail_address ? ` ${recipient.detail_address}` : ''}`,
      ``,
      `✨ 케어 완료 항목:`,
      selectedTags.length > 0 ? selectedTags.map(t => ` • ${t}`).join('\n') : ' • 기본 케어 및 안부 확인',
      ``,
      `📝 요양보호사 방문 일지:`,
      `${memoText.trim() ? memoText.trim() : '특이사항 없이 평온하게 일과를 보내셨습니다.'}`,
      ``,
      `어르신의 편안한 하루를 위해 늘 정성을 다하겠습니다. 감사합니다 🙏`
    ];
    return lines.join('\n');
  }, [recipient, dateStr, timeNow, selectedTags, memoText]);

  // 클립보드 복사
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error(e);
      alert('복사에 실패했습니다. 권한을 확인해주세요.');
    }
  };

  // 네이티브 공유 / 카카오톡 전달
  const handleNativeShare = async () => {
    if (!recipient) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${recipient.name} 어르신 방문 안심 리포트`,
          text: shareText
        });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error(err);
          handleCopy();
        }
      }
    } else {
      handleCopy();
      alert('공유 기능이 지원되지 않는 브라우저입니다. 리포트 내용이 클립보드에 복사되었으니 카카오톡에 붙여넣어 주세요!');
    }
  };

  // SMS 문자 발송
  const handleSmsShare = () => {
    const encText = encodeURIComponent(shareText);
    window.location.href = `sms:?body=${encText}`;
  };

  if (!recipient) return null;

  return (
    <Modal open={isOpen} onClose={onClose}>
      <div className="flex items-center justify-between p-6 border-b border-surface-border/60">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-[14px] bg-primary/10 text-primary flex items-center justify-center">
            <IconShieldCheck size={22} strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-xl font-black text-foreground tracking-tight">안심 공유 리포트</h2>
            <p className="text-xs font-semibold text-foreground/50">{recipient.name} 어르신 보호자 전달용</p>
          </div>
        </div>
        <IconButton onClick={onClose} className="rounded-[18px] bg-foreground/[0.04] hover:bg-foreground/[0.08]" aria-label="닫기">
          <IconX size={20} />
        </IconButton>
      </div>

      <div className="p-6 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
        {/* 케어 항목 원터치 체크 태그 */}
        <div>
          <span className="block text-xs font-black text-foreground/70 uppercase tracking-wider mb-2 pl-0.5">
            케어 항목 선택 (리포트에 자동 포함)
          </span>
          <div className="flex flex-wrap gap-1.5">
            {CARE_TAG_PRESETS.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`text-xs font-black px-3 py-1.5 rounded-full border transition-all active:scale-95 ${
                    active
                      ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                      : 'bg-surface text-foreground/70 border-surface-border/70 hover:bg-surface-muted'
                  }`}
                >
                  {active ? `✓ ${tag}` : `+ ${tag}`}
                </button>
              );
            })}
          </div>
        </div>

        {/* 방문 일지 내용 수정 인풋 */}
        <div>
          <span className="block text-xs font-black text-foreground/70 uppercase tracking-wider mb-1.5 pl-0.5">
            요양보호사 일지 / 전할 말씀
          </span>
          <textarea
            value={customMemo}
            placeholder={recipient.last_completed_memo || '어르신 특이사항이나 상태를 입력해주세요...'}
            onChange={(e) => setCustomMemo(e.target.value)}
            className="w-full h-20 p-3 bg-foreground/[0.03] dark:bg-white/[0.04] rounded-[18px] border border-surface-border/60 text-sm font-semibold leading-relaxed outline-none focus:border-primary transition-all resize-none placeholder:text-foreground/30 text-foreground"
          />
        </div>

        {/* 리포트 메시지 미리보기 카드 */}
        <div>
          <div className="flex items-center justify-between mb-1.5 px-0.5">
            <span className="text-xs font-black text-foreground/70 uppercase tracking-wider">
              공유 메시지 미리보기
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
            >
              {copied ? <IconCheck size={14} className="text-emerald-500" /> : <IconCopy size={14} />}
              {copied ? '복사됨!' : '텍스트 복사'}
            </button>
          </div>

          <div className="bg-[#FAF9F5] dark:bg-zinc-900 border border-amber-500/20 rounded-[22px] p-4 font-mono text-[13px] leading-relaxed text-foreground/80 whitespace-pre-wrap select-all shadow-inner">
            {shareText}
          </div>
        </div>

        {/* 빠른 전송 액션 버튼 */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={handleSmsShare}
            className="py-3.5 rounded-[20px] font-black text-foreground/80 border border-surface-border/60"
          >
            문자메시지 전송
          </Button>

          <Button
            type="button"
            onClick={handleNativeShare}
            className="py-3.5 rounded-[20px] font-black shadow-md bg-amber-400 hover:bg-amber-500 text-stone-900 border-none"
            startIcon={<IconShare size={18} strokeWidth={2.5} />}
          >
            카카오톡 / 안심 공유
          </Button>
        </div>
      </div>
    </Modal>
  );
}
