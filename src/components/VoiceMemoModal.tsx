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
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.lang = 'ko-KR';

        recognitionRef.current.onresult = (event: any) => {
          let currentTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              currentTranscript += event.results[i][0].transcript;
            }
          }
          if (currentTranscript) {
            setTranscript(prev => prev + (prev ? ' ' : '') + currentTranscript.trim());
          }
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          setIsRecording(false);
        };

        recognitionRef.current.onend = () => {
          setIsRecording(false);
        };
      }
    }
  }, []);

  // isOpen 바뀔 때 초기화
  useEffect(() => {
    if (isOpen) {
      setTranscript('');
      setIsRecording(false);
    } else {
      if (isRecording && recognitionRef.current) {
        recognitionRef.current.stop();
      }
    }
  }, [isOpen]);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert("이 브라우저에서는 음성 인식을 지원하지 않습니다.");
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  return (
    <Modal open={isOpen} onClose={onClose}>
      <div className="flex items-center justify-between px-5 pt-5 pb-2">
        <h2 className="text-lg font-extrabold text-primary">{recipientName} 어르신 방문 일지</h2>
        <IconButton onClick={onClose} aria-label="닫기">
          <IconX size={20} />
        </IconButton>
      </div>

      <div className="px-5 pb-6 pt-2 flex flex-col gap-4">
        <p className="text-[13px] font-bold text-foreground/60 leading-relaxed">
          방문 완료를 기록합니다.<br/>마이크 버튼을 누르고 특이사항을 말씀하시면 자동으로 문자로 변환됩니다.
        </p>

        <div className="relative border-2 border-surface-border rounded-xl p-4 bg-surface min-h-[120px] shadow-inner focus-within:border-primary transition-colors">
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="여기에 일지가 작성됩니다..."
            className="w-full h-full min-h-[100px] bg-transparent resize-none outline-none text-[14px] leading-relaxed"
          />
          
          <div className="absolute bottom-3 right-3">
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={toggleRecording}
              className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-colors ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-primary text-primary-foreground'}`}
            >
              {isRecording ? <IconPlayerStop size={24} /> : <IconMicrophone size={24} />}
            </motion.button>
          </div>
        </div>

        <div className="flex gap-2 mt-2">
          <Button type="button" variant="ghost" fullWidth onClick={() => onSave('')} className="py-3">
            메모 없이 완료
          </Button>
          <Button type="button" fullWidth onClick={() => onSave(transcript)} className="py-3" startIcon={<IconSend size={18} />}>
            저장 후 완료
          </Button>
        </div>
      </div>
    </Modal>
  );
}
