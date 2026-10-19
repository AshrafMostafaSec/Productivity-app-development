import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ashrafmostafa.anchoros',
  appName: 'AnchorOS',
  webDir: 'dist',
  plugins: { LocalNotifications: { presentationOptions: ['banner', 'list', 'sound'] } },
};

export default config;
