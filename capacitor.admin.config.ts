import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.novelara.admin',
  appName: 'Novelara Admin',
  webDir: 'www',
  server: {
    url: 'https://novelara.vercel.app/admin/login.html',
    cleartext: false,
    allowNavigation: ['novelara.vercel.app']
  },
  android: {
    backgroundColor: '#111827'
  }
};

export default config;
