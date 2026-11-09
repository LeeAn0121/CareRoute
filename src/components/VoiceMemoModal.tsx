'use client';
import { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { CareRouteDevice } from '@/lib/native';
import { Modal, IconButton, Button } from '@/components/ui';
import { IconX, IconMicrophone, IconPlayerStop, IconSend } from '@tabler/icons-react';
import { motion } from 'framer-motion';
import type { VitalsInput } from '@/lib/vitalsLogs';
import { fetchMedicationsForRecipient, type MedicationRow } from '@/lib/medications';

interface VoiceMemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (memo: string, vitals: VitalsInput) => void | Promise<void>;
  onSaveAndShare?: (memo: string, vitals: VitalsInput) => void | Promise<void>;
  recipientName: string;
  recipientId?: string;
  initialMemo?: string | null;
  saving?: boolean;
  saveError?: string;
  visitDateLabel?: string;
}

export default function VoiceMemoModal({ isOpen, onClose, onSave, onSaveAndShare, recipientName, recipientId, initialMemo, saving = false, saveError = '', visitDateLabel }: VoiceMemoModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [callbackError, setCallbackError] = useState('');
  const submitRef = useRef(false);
  const busy = saving || submitting;
  const close = () => { if (!busy && !submitRef.current) { stopRecognition(); onClose(); } };
  const save = async (memo: string, share = false) => {
    if (busy || submitRef.current) return;
    submitRef.current = true;
    setSubmitting(true);
    setCallbackError('');
    stopRecognition();
    try {
      await (share && onSaveAndShare ? onSaveAndShare(memo, collectVitals()) : onSave(memo, collectVitals()));
    } catch (error) {
      setCallbackError(error instanceof Error ? error.message : '저장하지 못했습니다. 다시 시도해주세요.');
    } finally {
      submitRef.current = false;
      setSubmitting(false);
    }
  };
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [systolicBp, setSystolicBp] = useState('');
  const [diastolicBp, setDiastolicBp] = useState('');
  const [bloodSugar, setBloodSugar] = useState('');
  const [temperature, setTemperature] = useState('');

  const [medications, setMedications] = useState<MedicationRow[]>([]);

  useEffect(() => {
    if (!isOpen || !recipientId) {
      setMedications([]);
      return;
    }
    fetchMedicationsForRecipient(recipientId).then(setMedications);
  }, [isOpen, recipientId]);

  const collectVitals = (): VitalsInput => ({
    systolicBp: systolicBp.trim() ? parseInt(systolicBp.trim(), 10) : null,
    diastolicBp: diastolicBp.trim() ? parseInt(diastolicBp.trim(), 10) : null,
    bloodSugar: bloodSugar.trim() ? parseInt(bloodSugar.trim(), 10) : null,
    temperature: temperature.trim() ? parseFloat(temperature.trim()) : null,
  });
  const recognitionRef = useRef<any>(null);
  const isRecordingRef = useRef<boolean>(false);
  const finalTranscriptRef = useRef<string>('');
  const initializedDraft = useRef<string | null>(null);

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

  const startRecognition = async () => {
    if (typeof window === 'undefined') return;
    if (Capacitor.isNativePlatform()) {
      setErrorMessage('');
      setIsRecording(true);
      try {
        const result = await CareRouteDevice.recognizeSpeech();
        if (result.text) setTranscript(current => [current.trim(), result.text.trim()].filter(Boolean).join(' '));
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : '음성 인식 서비스를 열지 못했습니다.');
      } finally { setIsRecording(false); }
      return;
    }
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

  // 모달이 열릴 때 상태 초기화 및 닫힐 때 음성 인식 중단
  useEffect(() => {
    if (isOpen) {
      const identity = `${recipientId || recipientName}/${visitDateLabel || ''}`;
      if (initializedDraft.current === identity) return;
      initializedDraft.current = identity;
      const initial = initialMemo || '';
      setTranscript(initial);
      setSystolicBp('');
      setDiastolicBp('');
      setBloodSugar('');
      setTemperature('');
      setInterimText('');
      setErrorMessage('');
      finalTranscriptRef.current = initial;
    } else {
      initializedDraft.current = null;
      stopRecognition();
    }
  }, [isOpen, initialMemo, recipientId, recipientName, visitDateLabel]);

  // A server refresh must not interrupt dictation for the same visit draft.
  useEffect(() => () => { stopRecognition(); }, [isOpen, recipientId, visitDateLabel]);

  const toggleRecording = () => {
    if (isRecording) {
      stopRecognition();
    } else {
      startRecognition();
    }
  };

  return (
    <Modal open={isOpen} onClose={close} closeOnBackdrop={!busy}>
      <div className="flex items-start justify-between gap-3 p-6 border-b border-surface-border/60">
        <div className="min-w-0 break-words">
          <h2 className="text-xl font-black text-primary tracking-tight">{recipientName} 어르신 방문 일지</h2>
          {visitDateLabel && <p className="mt-1 text-base font-bold text-primary break-words">{visitDateLabel}</p>}
          <p className="text-xs font-semibold text-foreground/50 mt-0.5">음성 또는 키보드로 일지를 작성하고 방문을 완료합니다.</p>
        </div>
        <IconButton onClick={close} disabled={busy} className="shrink-0 rounded-[18px] bg-foreground/[0.04] hover:bg-foreground/[0.08]" aria-label="닫기">
          <IconX size={20} />
        </IconButton>
      </div>

      <fieldset disabled={busy} aria-busy={busy} className="m-0 min-w-0 w-full border-0 p-6 flex flex-col gap-4">
        {/* Status Chip */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isRecording ? 'bg-red-500 animate-ping' : 'bg-foreground/30'}`} />
            <span className="text-xs font-black tracking-tight text-foreground/70">
              {isRecording ? (Capacitor.isNativePlatform() ? '기기 음성 입력을 진행하는 중...' : '음성을 받아적는 중...') : '마이크로 음성 입력하거나 아래에 직접 작성하세요'}
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
        <div className="flex flex-wrap gap-1.5 pb-1">
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
              className="px-2.5 py-1.5 rounded-full text-[11px] font-bold bg-foreground/[0.04] dark:bg-white/[0.06] hover:bg-foreground/[0.08] text-foreground/75 border border-surface-border/50 whitespace-normal break-words text-left active:scale-95 transition-all min-w-0"
            >
              + {phrase}
            </button>
          ))}
        </div>

        {/* 등록된 복약 시간표를 체크리스트처럼 눌러서 "복약 확인"을 일지에 바로 남긴다 */}
        {medications.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="block text-xs font-black text-foreground/70 uppercase tracking-wider pl-0.5">
              복약 확인 (눌러서 기록)
            </span>
            <div className="flex flex-wrap gap-1.5 pb-1">
              {medications.map((med) => {
                const phrase = `${med.drug_name} 복약 확인${med.times_of_day ? `(${med.times_of_day.split(',').join('/')})` : ''}`;
                return (
                  <button
                    key={med.id}
                    type="button"
                    onClick={() => {
                      const updated = transcript ? `${transcript.trim()} ${phrase}` : phrase;
                      setTranscript(updated);
                      finalTranscriptRef.current = updated;
                    }}
                    className="px-2.5 py-1.5 rounded-full text-[11px] font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/25 whitespace-normal break-words text-left active:scale-95 transition-all min-w-0"
                  >
                    💊 {med.drug_name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 활력징후(선택): 혈압/혈당/체온을 숫자로 남겨 추이를 볼 수 있게 한다 */}
        <div>
          <span className="block text-xs font-black text-foreground/70 uppercase tracking-wider mb-1.5 pl-0.5">
            활력징후 (선택)
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            <div className="flex flex-col gap-1">
              <input
                type="number"
                inputMode="numeric"
                value={systolicBp}
                onChange={(e) => setSystolicBp(e.target.value)}
                placeholder="수축기"
                className="w-full p-2.5 bg-foreground/[0.03] dark:bg-white/[0.04] rounded-[14px] border border-surface-border/60 text-[13px] font-bold outline-none focus:border-primary text-center text-foreground placeholder:text-foreground/30"
              />
              <span className="text-[10px] font-bold text-foreground/40 text-center">수축기(mmHg)</span>
            </div>
            <div className="flex flex-col gap-1">
              <input
                type="number"
                inputMode="numeric"
                value={diastolicBp}
                onChange={(e) => setDiastolicBp(e.target.value)}
                placeholder="이완기"
                className="w-full p-2.5 bg-foreground/[0.03] dark:bg-white/[0.04] rounded-[14px] border border-surface-border/60 text-[13px] font-bold outline-none focus:border-primary text-center text-foreground placeholder:text-foreground/30"
              />
              <span className="text-[10px] font-bold text-foreground/40 text-center">이완기(mmHg)</span>
            </div>
            <div className="flex flex-col gap-1">
              <input
                type="number"
                inputMode="numeric"
                value={bloodSugar}
                onChange={(e) => setBloodSugar(e.target.value)}
                placeholder="혈당"
                className="w-full p-2.5 bg-foreground/[0.03] dark:bg-white/[0.04] rounded-[14px] border border-surface-border/60 text-[13px] font-bold outline-none focus:border-primary text-center text-foreground placeholder:text-foreground/30"
              />
              <span className="text-[10px] font-bold text-foreground/40 text-center">혈당(mg/dL)</span>
            </div>
            <div className="flex flex-col gap-1">
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                placeholder="체온"
                className="w-full p-2.5 bg-foreground/[0.03] dark:bg-white/[0.04] rounded-[14px] border border-surface-border/60 text-[13px] font-bold outline-none focus:border-primary text-center text-foreground placeholder:text-foreground/30"
              />
              <span className="text-[10px] font-bold text-foreground/40 text-center">체온(℃)</span>
            </div>
          </div>
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
            placeholder={isRecording ? '음성 인식 결과가 여기에 추가됩니다...' : '방문 내용을 직접 작성하거나 음성으로 입력하세요.'}
            className="w-full h-full min-h-[120px] pb-20 bg-transparent resize-none outline-none text-[15px] font-medium leading-relaxed text-foreground placeholder:text-foreground/30"
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

        {(saveError || callbackError) && <p role="alert" className="p-3 bg-red-500/10 border border-red-500/20 rounded-[18px] text-base font-bold text-red-600 dark:text-red-400 break-words">{saveError || callbackError}</p>}

        <div className="flex flex-col gap-2 mt-2">
          <div className="flex flex-col gap-2">
            <Button 
              type="button" 
              variant="ghost" 
              fullWidth 
              disabled={busy}
              onClick={() => { void save(''); }}
              className="py-3 rounded-[18px] font-bold text-foreground/60 text-base whitespace-normal break-words"
            >
              메모 없이 방문 완료
            </Button>
            <Button
              type="button"
              fullWidth
              disabled={busy}
              onClick={() => { void save(transcript); }}
              className="py-3 rounded-[18px] font-black shadow-sm text-base whitespace-normal break-words"
              startIcon={<IconSend size={16} />}
            >
              기록하고 방문 완료
            </Button>
          </div>

          {onSaveAndShare && (
            <Button
              type="button"
              fullWidth
              disabled={busy}
              onClick={() => { void save(transcript, true); }}
              className="py-3.5 rounded-[18px] font-black bg-amber-400 hover:bg-amber-500 text-stone-900 border-none shadow-md text-base whitespace-normal break-words"
              startIcon={<span className="text-base">💙</span>}
            >
              기록하고 방문 완료 · 보호자 안심 공유
            </Button>
          )}
        </div>
      </fieldset>
    </Modal>
  );
}
