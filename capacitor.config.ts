import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.novelara.reader',
  appName: 'Novelara',
  webDir: 'www',
  server: {
    url: 'https://novelara.vercel.app',
    cleartext: false,
    allowNavigation: ['novelara.vercel.app']
  },
  android: {
    backgroundColor: '#111827'
  }
};

export default config;
