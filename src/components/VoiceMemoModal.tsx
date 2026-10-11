'use client';
import { useState, useEffect, useRef } from 'react';
import { Modal, IconButton, Button } from '@/components/ui';
import { IconX, IconMicrophone, IconPlayerStop, IconSend } from '@tabler/icons-react';
import { motion } from 'framer-motion';

interface VoiceMemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (memo: string) => void;
  onSaveAndShare?: (memo: string) => void;
  recipientName: string;
  initialMemo?: string | null;
}

export default function VoiceMemoModal({ isOpen, onClose, onSave, onSaveAndShare, recipientName, initialMemo }: VoiceMemoModalProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const recognitionRef = useRef<any>(null);
  const isRecordingRef = useRef<boolean>(false);
  const finalTranscriptRef = useRef<string>('');

  const stopRecognition = () => {
    isRecordingRef.current = false;
    setIsRecording(false);
    setInterimText('');
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {}
      recognitionRef.current = null;
    }
  };

  const startRecognition = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("현재 사용하시는 브라우저에서 마이크 음성 인식이 지원되지 않습니다. Chrome, Safari 또는 Samsung Internet을 이용해주세요.");
      return;
    }

    // Clean up previous instance if any
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (e) {}
      recognitionRef.current = null;
    }

    setErrorMessage('');
    finalTranscriptRef.current = transcript.trim();
    setInterimText('');

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'ko-KR';
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        isRecordingRef.current = true;
        setIsRecording(true);
        setErrorMessage('');
      };

      recognition.onresult = (event: any) => {
        let currentInterim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const item = event.results[i];
          const text = item[0]?.transcript || '';
          if (item.isFinal) {
            const prev = finalTranscriptRef.current;
            finalTranscriptRef.current = prev ? `${prev} ${text.trim()}` : text.trim();
          } else {
            currentInterim += text;
          }
        }

        setInterimText(currentInterim);
        const combined = finalTranscriptRef.current + (currentInterim ? (finalTranscriptRef.current ? ' ' : '') + currentInterim : '');
        setTranscript(combined);
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setErrorMessage('마이크 접근 권한이 허용되지 않았습니다. 브라우저 설정에서 마이크를 켜주세요.');
          stopRecognition();
        } else if (event.error === 'no-speech') {
          // Voice paused briefly, don't stop abruptly
        } else if (event.error === 'network') {
          setErrorMessage('네트워크 상태가 원활하지 않아 음성 인식이 지연되고 있습니다.');
        } else {
          setErrorMessage(`음성 인식 오류 (${event.error})`);
        }
      };

      recognition.onend = () => {
        // If user didn't intentionally stop, auto restart to keep continuous listening
        if (isRecordingRef.current) {
          try {
            recognition.start();
          } catch (e) {
            isRecordingRef.current = false;
            setIsRecording(false);
          }
        } else {
          setIsRecording(false);
          setInterimText('');
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e: any) {
      console.error("Failed to start speech recognition:", e);
      setErrorMessage('마이크를 시작할 수 없습니다. 마이크 권한을 확인해주세요.');
      stopRecognition();
    }
  };

  // isOpen 바뀔 때 초기화
  useEffect(() => {
    if (isOpen) {
      const initial = initialMemo || '';
      setTranscript(initial);
      setInterimText('');
      setErrorMessage('');
      finalTranscriptRef.current = initial;
      stopRecognition();
    } else {
      stopRecognition();
    }
    return () => {
      stopRecognition();
    };
  }, [isOpen, initialMemo]);

  const toggleRecording = () => {
    if (isRecording) {
      stopRecognition();
    } else {
      startRecognition();
    }
  };

  return (
    <Modal open={isOpen} onClose={onClose}>
      <div className="flex items-center justify-between p-6 border-b border-surface-border/60">
        <div>
          <h2 className="text-xl font-black text-primary tracking-tight">{recipientName} 어르신 방문 일지</h2>
          <p className="text-xs font-semibold text-foreground/50 mt-0.5">실시간 음성 인식으로 방문 내용을 기록합니다.</p>
        </div>
        <IconButton onClick={onClose} className="rounded-[18px] bg-foreground/[0.04] hover:bg-foreground/[0.08]" aria-label="닫기">
          <IconX size={20} />
        </IconButton>
      </div>

      <div className="p-6 flex flex-col gap-4">
        {/* Status Chip */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isRecording ? 'bg-red-500 animate-ping' : 'bg-foreground/30'}`} />
            <span className="text-xs font-black tracking-tight text-foreground/70">
              {isRecording ? '음성을 실시간으로 받아적는 중...' : '마이크를 눌러 음성 입력을 시작하세요'}
            </span>
          </div>
          {transcript && (
            <button
              type="button"
              onClick={() => {
                setTranscript('');
                setInterimText('');
                finalTranscriptRef.current = '';
              }}
              className="text-xs font-bold text-foreground/40 hover:text-rose-500 transition-colors"
            >
              내용 지우기
            </button>
          )}
        </div>

        {/* Quick Phrases for One-Touch Memo */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {[
            '식사 및 투약 완료, 상태 양호',
            '혈압 및 체온 정상, 대화 나누심',
            '가벼운 실내 보행 보조 및 환기 완료',
            '기분 좋으시고 특이사항 없음',
          ].map((phrase) => (
            <button
              key={phrase}
              type="button"
              onClick={() => {
                const updated = transcript ? `${transcript.trim()} ${phrase}` : phrase;
                setTranscript(updated);
                finalTranscriptRef.current = updated;
              }}
              className="px-2.5 py-1.5 rounded-full text-[11px] font-bold bg-foreground/[0.04] dark:bg-white/[0.06] hover:bg-foreground/[0.08] text-foreground/75 border border-surface-border/50 whitespace-nowrap active:scale-95 transition-all shrink-0"
            >
              + {phrase}
            </button>
          ))}
        </div>

        {/* Error / Guide Message */}
        {errorMessage && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-[18px] text-xs font-bold text-red-600 dark:text-red-400">
            ⚠️ {errorMessage}
          </div>
        )}

        {/* Live Input Container */}
        <div className={`relative border-2 rounded-[24px] p-4.5 bg-surface min-h-[150px] shadow-sm transition-all ${
          isRecording ? 'border-primary ring-4 ring-primary/10' : 'border-surface-border/80 focus-within:border-primary'
        }`}>
          <textarea
            value={transcript}
            onChange={(e) => {
              setTranscript(e.target.value);
              finalTranscriptRef.current = e.target.value;
            }}
            placeholder={isRecording ? '말씀하시면 실시간으로 작성됩니다...' : '여기에 일지가 작성됩니다. 직접 타이핑하셔도 됩니다.'}
            className="w-full h-full min-h-[120px] bg-transparent resize-none outline-none text-[15px] font-medium leading-relaxed text-foreground placeholder:text-foreground/30"
          />
          
          <div className="absolute bottom-3.5 right-3.5 flex items-center gap-2">
            {isRecording && (
              <span className="text-[11px] font-black text-red-500 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 animate-pulse">
                REC
              </span>
            )}
            <motion.button
              type="button"
              whileTap={{ scale: 0.88 }}
              onClick={toggleRecording}
              className={`w-13 h-13 rounded-[22px] flex items-center justify-center shadow-md transition-all ${
                isRecording 
                  ? 'bg-red-500 text-white shadow-red-500/40' 
                  : 'bg-primary text-primary-foreground hover:shadow-lg'
              }`}
              title={isRecording ? '음성인식 중지' : '음성인식 시작'}
            >
              {isRecording ? <IconPlayerStop size={24} /> : <IconMicrophone size={24} />}
            </motion.button>
          </div>
        </div>

        <div className="flex flex-col gap-2 mt-2">
          <div className="flex gap-2">
            <Button 
              type="button" 
              variant="ghost" 
              fullWidth 
              onClick={() => onSave('')} 
              className="py-3 rounded-[18px] font-bold text-foreground/60 text-xs sm:text-sm"
            >
              메모 없이 완료
            </Button>
            <Button 
              type="button" 
              fullWidth 
              onClick={() => onSave(transcript)} 
              className="py-3 rounded-[18px] font-black shadow-sm text-xs sm:text-sm" 
              startIcon={<IconSend size={16} />}
            >
              기록 저장
            </Button>
          </div>

          {onSaveAndShare && (
            <Button
              type="button"
              fullWidth
              onClick={() => onSaveAndShare(transcript)}
              className="py-3.5 rounded-[18px] font-black bg-amber-400 hover:bg-amber-500 text-stone-900 border-none shadow-md text-sm"
              startIcon={<span className="text-base">💙</span>}
            >
              저장하고 보호자 안심 공유하기
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
