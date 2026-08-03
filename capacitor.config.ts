import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.360adadee28d415aa234af87562af5ff',
  appName: 'tutwine',
  webDir: 'dist',
  server: {
    url: 'https://360adade-e28d-415a-a234-af87562af5ff.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  ios: {
    contentInset: 'never',
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
