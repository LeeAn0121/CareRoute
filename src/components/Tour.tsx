import React from 'react';
import { Joyride, EventData, STATUS } from 'react-joyride';

interface TourProps {
  onComplete: () => void;
}

export default function Tour({ onComplete }: TourProps) {
  const steps = [
    {
      target: 'body',
      content: '케어루트에 오신 것을 환영합니다! 🎉\n간단한 앱 사용 방법을 알려드릴게요.',
      placement: 'center' as const,
      disableBeacon: true,
    },
    {
      target: '#tour-header',
      content: '이곳에서 원하시는 시/도, 군/구, 동/읍/면을 선택하면 지도가 해당 동네로 빠르게 이동합니다.',
      disableBeacon: true,
    },
    {
      target: '#tour-add-button',
      content: '플러스 버튼을 눌러 새로운 어르신을 등록해 보세요! (이름, 주소, 방문 일정 등)',
      disableBeacon: true,
    },
    {
      target: '#tour-bottom-nav',
      content: '하단 탭을 통해 언제든지 [지도], [명단 관리], [오늘의 추천 경로] 화면으로 이동할 수 있습니다.',
      disableBeacon: true,
    },
    {
      target: 'body',
      content: '마지막으로, 현재 위치 표시와 방문 시간 알림을 위해 권한을 허용해 주시면 준비가 끝납니다! 🚀',
      placement: 'center' as const,
      disableBeacon: true,
    }
  ];

  const handleJoyrideCallback = async (data: EventData) => {
    const { status, action } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status) || action === 'close') {
      // 권한 요청
      if ('Notification' in window && Notification.permission === 'default') {
        try {
          await Notification.requestPermission();
        } catch (e) {}
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
      styles={{
        tooltipContainer: {
          textAlign: 'left' as const,
          whiteSpace: 'pre-line',
          lineHeight: '1.5'
        },
        buttonPrimary: {
          backgroundColor: 'var(--primary)'
        },
        buttonBack: {
          color: 'var(--primary)'
        }
      }}
      locale={{
        back: '이전',
        close: '닫기',
        last: '시작하기',
        next: '다음',
        skip: '건너뛰기',
      }}
    />
  );
}
