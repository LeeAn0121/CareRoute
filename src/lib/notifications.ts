import { supabase } from './supabase';

export function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export interface NotificationStatus {
  isSupported: boolean;
  permission: NotificationPermission | 'unsupported';
  isIOS: boolean;
  isStandalone: boolean;
  hasSubscription: boolean;
}

export async function getDetailedNotificationStatus(): Promise<NotificationStatus> {
  if (typeof window === 'undefined') {
    return {
      isSupported: false,
      permission: 'unsupported',
      isIOS: false,
      isStandalone: false,
      hasSubscription: false,
    };
  }

  const isIOS = /iPad|iPhone|iPod/i.test(navigator.userAgent);
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true;

  const isSupported = 'Notification' in window && 'serviceWorker' in navigator;
  const permission = isSupported ? Notification.permission : 'unsupported';

  let hasSubscription = false;
  if (isSupported && permission === 'granted' && 'PushManager' in window) {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      hasSubscription = !!sub;
    } catch (e) {
      console.warn('Subscription check error:', e);
    }
  }

  return {
    isSupported,
    permission,
    isIOS,
    isStandalone,
    hasSubscription,
  };
}

export async function registerPushSubscription(): Promise<{ success: boolean; error?: string }> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return { success: false, error: '이 브라우저는 웹 푸시를 지원하지 않습니다.' };
    }

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      return { success: false, error: 'VAPID 설정이 누락되었습니다.' };
    }

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
    }

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return { success: false, error: '구독 키를 생성하지 못했습니다.' };
    }

    const { error } = await supabase.from('push_subscriptions').upsert(
      { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth },
      { onConflict: 'endpoint' }
    );

    if (error) {
      console.warn('푸시 구독 저장 실패 (Supabase RLS 확인 필요):', error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('푸시 구독 중 예외 발생:', err);
    return { success: false, error: err?.message || '푸시 구독에 실패했습니다.' };
  }
}

export async function requestNotificationPermission(): Promise<{
  success: boolean;
  permission: NotificationPermission | 'unsupported';
  error?: string;
}> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { success: false, permission: 'unsupported', error: '이 브라우저는 알림을 지원하지 않습니다.' };
  }

  try {
    const result = await Notification.requestPermission();
    if (result === 'granted') {
      await registerPushSubscription();
      return { success: true, permission: result };
    } else {
      return { success: false, permission: result, error: result === 'denied' ? '알림 권한이 차단되었습니다.' : '알림 권한 요청이 취소되었습니다.' };
    }
  } catch (err: any) {
    return { success: false, permission: 'denied', error: err?.message || '알림 권한 요청 중 오류 발생' };
  }
}

export async function sendTestNotification(): Promise<{ success: boolean; error?: string }> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { success: false, error: '알림 기능이 지원되지 않는 브라우저입니다.' };
  }

  if (Notification.permission !== 'granted') {
    return { success: false, error: '알림 권한이 허용되지 않았습니다. 먼저 권한을 허용해주세요.' };
  }

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const iconUrl = `${origin}/CareRoute/icon-192.png`;

    const title = '케어루트 시스템 알림 테스트 🔔';
    const options: NotificationOptions = {
      body: '시스템 알림이 정상적으로 작동하고 있습니다! 어르신 방문 일정을 놓치지 않고 수신하실 수 있습니다. 💙',
      icon: iconUrl,
      badge: iconUrl,
      tag: 'careroute-test-notification',
      data: { url: `${origin}/CareRoute/` },
    };

    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(title, options);
        return { success: true };
      } catch (swErr) {
        console.warn('SW notification fallback to Window Notification:', swErr);
      }
    }

    new Notification(title, options);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || '알림 전송 중 오류가 발생했습니다.' };
  }
}
