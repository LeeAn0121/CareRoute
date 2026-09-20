import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from './ui';
import { IconMapPin, IconList, IconNavigation, IconBell, IconCurrentLocation } from '@tabler/icons-react';

interface OnboardingProps {
  onComplete: () => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: '케어루트에 오신 것을\n환영합니다! 🎉',
      description: '방문 요양 보호사님을 위한\n스마트한 동선 관리 도우미입니다.',
      icon: <IconMapPin size={64} className="text-[#F5A524]" />,
      color: 'bg-amber-50'
    },
    {
      title: '지도에서 한눈에 파악하기',
      description: '어르신들의 위치를 지도에서 확인하고,\n상단 메뉴를 통해 원하는 동네로\n빠르게 이동할 수 있습니다.',
      icon: <IconMapPin size={64} className="text-blue-500" />,
      color: 'bg-blue-50'
    },
    {
      title: '편리한 명단 관리',
      description: '명단 보기 탭에서 어르신을 검색하고,\n오늘 방문할 분들을\n쉽게 필터링해서 확인하세요.',
      icon: <IconList size={64} className="text-emerald-500" />,
      color: 'bg-emerald-50'
    },
    {
      title: '최적 경로 추천',
      description: '오늘의 경로 탭에서\n직선거리 기준 가장 효율적인\n방문 순서를 추천받을 수 있습니다.',
      icon: <IconNavigation size={64} className="text-indigo-500" />,
      color: 'bg-indigo-50'
    },
    {
      title: '원활한 사용을 위해\n권한이 필요합니다',
      description: '내 위치 확인과 방문 시간 알림을 위해\n아래 권한들을 허용해 주세요.',
      icon: <IconBell size={64} className="text-rose-500" />,
      color: 'bg-rose-50'
    }
  ];

  const handleNext = async () => {
    if (step === steps.length - 1) {
      // 마지막 단계: 권한 요청
      requestPermissions();
    } else {
      setStep(s => s + 1);
    }
  };

  const requestPermissions = async () => {
    // 1. 알림 권한 요청
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (e) {
        console.error(e);
      }
    }
    
    // 2. 위치 권한 요청 (브라우저 자체 팝업 트리거)
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        () => {
          // 성공
          finish();
        },
        () => {
          // 거부 또는 실패해도 튜토리얼은 완료 처리
          finish();
        },
        { enableHighAccuracy: false, timeout: 5000 }
      );
    } else {
      finish();
    }
  };

  const finish = () => {
    localStorage.setItem('careroute_tutorial_done', 'true');
    onComplete();
  };

  const currentStep = steps[step];

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-white">
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className={`flex-1 flex flex-col items-center justify-center p-8 text-center ${currentStep.color} transition-colors duration-500`}
        >
          <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-lg mb-8">
            {currentStep.icon}
          </div>
          
          <h2 className="text-2xl font-black text-[#12203D] mb-4 whitespace-pre-line leading-tight">
            {currentStep.title}
          </h2>
          
          <p className="text-slate-600 font-medium whitespace-pre-line leading-relaxed">
            {currentStep.description}
          </p>

          {step === steps.length - 1 && (
            <div className="mt-8 flex flex-col gap-3 w-full max-w-[240px]">
              <div className="flex items-center gap-3 bg-white p-3 rounded-xl shadow-sm">
                <IconCurrentLocation className="text-blue-500" size={24} />
                <span className="font-bold text-sm text-slate-700 text-left">위치 정보 (내 위치 표시)</span>
              </div>
              <div className="flex items-center gap-3 bg-white p-3 rounded-xl shadow-sm">
                <IconBell className="text-rose-500" size={24} />
                <span className="font-bold text-sm text-slate-700 text-left">알림 (방문 시간 안내)</span>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="p-6 bg-white pb-[calc(env(safe-area-inset-bottom)+24px)] flex flex-col gap-4 shadow-[0_-10px_20px_rgba(0,0,0,0.03)]">
        <div className="flex justify-center gap-2 mb-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${i === step ? 'w-6 bg-[#12203D]' : 'w-2 bg-slate-200'}`}
            />
          ))}
        </div>
        
        <Button onClick={handleNext} className="w-full py-4 text-lg">
          {step === steps.length - 1 ? '권한 허용하고 시작하기' : '다음'}
        </Button>
      </div>
    </div>
  );
}
