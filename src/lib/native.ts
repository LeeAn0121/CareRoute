import { Capacitor, registerPlugin } from '@capacitor/core';
import type { jsPDF } from 'jspdf';

export const CareRouteDevice = registerPlugin<{
  print(): Promise<void>;
  recognizeSpeech(): Promise<{ text: string }>;
  authorizeCalendar(): Promise<{ accessToken: string }>;
  getLocationPermission(): Promise<{ status: 'precise' | 'approximate' | 'not-granted' }>;
  openPermissionSettings(): Promise<void>;
}>('CareRouteDevice');

export async function shareOnDevice(data: ShareData): Promise<void> {
  const { Share } = await import('@capacitor/share');
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const paths: string[] = [];
  for (const file of data.files || []) {
    const encoded = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    const name = file.name.replace(/[/\\\x00-\x1f]/g, '_');
    const result = await Filesystem.writeFile({ path: `exports/${Date.now()}-${name}`, directory: Directory.Cache, data: encoded, recursive: true });
    paths.push(result.uri);
  }
  await Share.share({ title: data.title, text: data.text, url: data.url, files: paths.length ? paths : undefined, dialogTitle: '저장 또는 공유할 앱 선택' });
}

export async function savePdf(pdf: jsPDF, filename: string) {
  if (!Capacitor.isNativePlatform()) { pdf.save(filename); return; }
  await shareOnDevice({ files: [new File([pdf.output('blob')], filename, { type: 'application/pdf' })], title: filename });
}

export async function downloadBlob(blob: Blob, filename: string) {
  if (Capacitor.isNativePlatform()) {
    await shareOnDevice({ files: [new File([blob], filename, { type: blob.type })], title: filename });
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function installNativeSharing() {
  if (!Capacitor.isNativePlatform()) return;
  Object.defineProperty(navigator, 'share', { configurable: true, value: shareOnDevice });
  Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
  window.print = () => { void CareRouteDevice.print().catch(() => alert('인쇄 서비스를 열지 못했습니다. PDF 공유를 이용해 주세요.')); };
}

export async function scheduleVisitNotifications(items: { at: Date; recipientId: string }[]) {
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  if ((await LocalNotifications.checkPermissions()).display !== 'granted') return;
  const pending = await LocalNotifications.getPending();
  const owned = pending.notifications.filter(item => item.id >= 10000 && item.id < 11000);
  if (owned.length) await LocalNotifications.cancel({ notifications: owned.map(({ id }) => ({ id })) });
  const upcoming = items.filter(item => item.at.getTime() > Date.now()).sort((a, b) => +a.at - +b.at).slice(0, 200);
  if (upcoming.length) await LocalNotifications.schedule({ notifications: upcoming.map((item, index) => ({
    id: 10000 + index, title: '방문 일정 알림', body: '예정된 방문 시간이 다가옵니다. 케어루트에서 일정을 확인해 주세요.',
    isExactNotification: false,
    schedule: { at: item.at, allowWhileIdle: true }, extra: { recipientId: item.recipientId },
  })) });
}
