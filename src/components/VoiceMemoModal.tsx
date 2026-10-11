'use client';
import { useState, useEffect, useRef } from 'react';
import { Modal, IconButton, Button } from '@/components/ui';
import { IconX, IconMicrophone, IconPlayerStop, IconSend } from '@tabler/icons-react';
import { motion } from 'framer-motion';

interface VoiceMemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (memo: string) => void;
  recipientName: string;
}

export default function VoiceMemoModal({ isOpen, onClose, onSave, recipientName }: VoiceMemoModalProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true; // 실시간 음성 인식 활성화
        recognition.lang = 'ko-KR';

        recognition.onresult = (event: any) => {
          let currentInterim = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const piece = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              const prev = finalTranscriptRef.current;
              finalTranscriptRef.current = prev ? `${prev} ${piece.trim()}` : piece.trim();
            } else {
              currentInterim += piece;
            }
          }

          setInterimText(currentInterim);
          const fullText = finalTranscriptRef.current + (currentInterim ? (finalTranscriptRef.current ? ' ' : '') + currentInterim : '');
          setTranscript(fullText);
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          setIsRecording(false);
          setInterimText('');
        };

        recognition.onend = () => {
          setIsRecording(false);
          setInterimText('');
        };

        recognitionRef.current = recognition;
      }
    }
  }, []);

  // isOpen 바뀔 때 초기화
  useEffect(() => {
    if (isOpen) {
      setTranscript('');
      setInterimText('');
      finalTranscriptRef.current = '';
      setIsRecording(false);
    } else {
      if (isRecording && recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setInterimText('');
    }
  }, [isOpen]);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert("이 브라우저에서는 음성 인식을 지원하지 않습니다. Chrome 또는 Safari 최신 버전을 권장합니다.");
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
      setInterimText('');
    } else {
      try {
        finalTranscriptRef.current = transcript.trim();
        setInterimText('');
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (e) {
        console.error(e);
      }
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

        <div className="flex gap-2.5 mt-2">
          <Button 
            type="button" 
            variant="ghost" 
            fullWidth 
            onClick={() => onSave('')} 
            className="py-3.5 rounded-[20px] font-bold text-foreground/60"
          >
            메모 없이 완료
          </Button>
          <Button 
            type="button" 
            fullWidth 
            onClick={() => onSave(transcript)} 
            className="py-3.5 rounded-[20px] font-black shadow-sm" 
            startIcon={<IconSend size={18} />}
          >
            저장 후 완료
          </Button>
        </div>
      </div>
    </Modal>
  );
}
