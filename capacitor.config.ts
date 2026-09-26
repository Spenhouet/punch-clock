import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.spenhouet.punchclock',
  appName: 'PunchClock',
  webDir: 'build',
  plugins: {
    SystemBars: {
      insetsHandling: 'css'
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_punchclock',
      iconColor: '#0f766e'
    }
  }
};

export default config;
