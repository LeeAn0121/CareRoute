import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.leean0121.careroute',
  appName: '케어루트',
  webDir: 'mobile-www',
  server: { androidScheme: 'https', appStartPath: '/CareRoute/', errorPath: 'CareRoute/webview-update.html' },
  android: { allowMixedContent: false, minWebViewVersion: 111, zoomEnabled: true },
  plugins: { LocalNotifications: { smallIcon: 'ic_careroute_notification', iconColor: '#2563EB' } },
};

export default config;
