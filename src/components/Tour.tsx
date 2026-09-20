import React from 'react';
import { Joyride, EventData, STATUS, TooltipRenderProps } from 'react-joyride';
import { motion } from 'motion/react';
import { IconMapPin, IconUserPlus, IconCategory, IconTarget, IconStar } from '@tabler/icons-react';

interface TourProps {
  onComplete: () => void;
}

const CustomTooltip = ({
  index,
  isLastStep,
  step,
  backProps,
  closeProps,
  primaryProps,
  skipProps,
  tooltipProps,
}: TooltipRenderProps) => {
  return (
    <motion.div
      {...tooltipProps}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      className="bg-surface/95 backdrop-blur-2xl border border-surface-border/50 p-6 rounded-[24px] shadow-2xl shadow-foreground/20 max-w-[320px] relative overflow-hidden"
    >
      {/* 장식용 빛 반사 효과 */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-2xl" />
      <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-accent/10 rounded-full blur-2xl" />

      <div className="relative z-10">
        {step.title && (
          <h3 className="font-black text-xl text-primary mb-3 flex items-center gap-2 tracking-tight">
            {step.title}
          </h3>
        )}
        
        <div className="text-foreground/85 font-semibold text-[15px] leading-relaxed mb-6 whitespace-pre-line">
          {step.content}
        </div>

        <div className="flex items-center justify-between mt-2">
          {index > 0 ? (
            <button
              {...backProps}
              className="px-4 py-2.5 rounded-xl text-sm font-bold text-foreground/60 bg-surface hover:bg-surface-muted border border-surface-border transition-colors active:scale-95"
            >
              이전
            </button>
          ) : (
            <div /> // spacer
          )}
          
          <div className="flex gap-2 items-center">
            <button
              {...skipProps}
              className="px-3 py-2.5 rounded-xl text-sm font-bold text-foreground/40 hover:text-foreground/70 transition-colors active:scale-95"
            >
              건너뛰기
            </button>
            
            <button
              {...primaryProps}
              className="px-5 py-2.5 rounded-xl text-sm font-black text-primary-foreground bg-primary shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all active:scale-95 flex items-center gap-1"
            >
              {isLastStep ? '시작하기 🚀' : '다음'}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default function Tour({ onComplete }: TourProps) {
  const steps = [
    {
      target: 'body',
      title: <><IconStar className="text-accent" /> 환영합니다!</>,
      content: '케어루트에 오신 것을 환영합니다!\n스마트한 동선 관리를 위한 간단한 사용법을 알려드릴게요.',
      placement: 'center' as const,
      disableBeacon: true,
    },
    {
      target: '#tour-header',
      title: <><IconTarget className="text-primary" /> 동네 이동하기</>,
      content: '이곳에서 원하시는 시/도, 군/구, 동/읍/면을 선택하면 지도가 해당 동네로 빠르게 이동합니다.',
      disableBeacon: true,
    },
    {
      target: '#tour-add-button',
      title: <><IconUserPlus className="text-primary" /> 어르신 등록</>,
      content: '플러스 버튼을 눌러 새로운 어르신을 등록해 보세요! (이름, 주소, 방문 일정 등)',
      disableBeacon: true,
    },
    {
      target: '#tour-bottom-nav',
      title: <><IconCategory className="text-primary" /> 메뉴 이동</>,
      content: '하단 탭을 통해 언제든지 [지도], [명단 관리], [오늘의 경로], [설정] 화면으로 이동할 수 있습니다.',
      disableBeacon: true,
    },
    {
      target: 'body',
      title: <><IconMapPin className="text-primary" /> 거의 다 왔어요!</>,
      content: '마지막으로, 현재 위치 표시와 방문 시간 알림을 위해 권한을 허용해 주시면 모든 준비가 끝납니다!',
      placement: 'center' as const,
      disableBeacon: true,
    }
  ];

  const handleJoyrideCallback = async (data: EventData) => {
    const { status, action } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status) || action === 'close') {
      if ('Notification' in window && Notification.permission === 'default') {
        try { await Notification.requestPermission(); } catch (e) {}
      }
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          () => onComplete(),
          () => onComplete(),
          { enableHighAccuracy: false, timeout: 5000 }
        );
      } else {
        onComplete();
      }
    }
  };

  return (
    <Joyride
      steps={steps}
      run={true}
      continuous={true}
      onEvent={handleJoyrideCallback}
      tooltipComponent={CustomTooltip}
    />
  );
}
