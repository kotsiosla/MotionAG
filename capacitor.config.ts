import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.f8a3ad1a7b3b47a5ae4339e39a46bfac',
  appName: 'motionbus',
  webDir: 'dist',
  server: {
    url: 'https://f8a3ad1a-7b3b-47a5-ae43-39e39a46bfac.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#488AFF',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
