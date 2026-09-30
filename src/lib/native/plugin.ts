import { registerPlugin, type PermissionState, type PluginListenerHandle } from '@capacitor/core';

export type ClockStatus = 'out' | 'working' | 'break';

/** A stamp recorded natively while the web layer was not running. */
export interface NativeEvent {
  action: 'in' | 'out' | 'break' | 'resume';
  at: number;
  source: 'wifi' | 'notification';
  /** Wi-Fi the phone was on at that moment, when known. */
  ssid?: string;
}

export interface WifiConfig {
  enabled: boolean;
  ssid: string;
  mode: 'ask' | 'auto';
  clockOutOnDisconnect: boolean;
  graceMinutes: number;
  breakWindow: boolean;
  breakFromMinutes: number;
  breakToMinutes: number;
}

export interface NativePermissions {
  location: PermissionState;
  backgroundLocation: PermissionState;
  notifications: PermissionState;
}

export interface PunchClockPlugin {
  /** Mirror the clock state into the ongoing notification / foreground service and the widget. */
  sync(options: {
    status: ClockStatus;
    /** Start of the running segment. */
    since: number;
    /** Work time today including the running segment, at call time. */
    workedMs: number;
    plannedEnd?: number;
    notifications: boolean;
    /** Current overtime balance in minutes, shown on the home screen widget. */
    balanceMinutes: number;
  }): Promise<void>;
  drainEvents(): Promise<{ events: NativeEvent[] }>;
  configureWifi(options: WifiConfig): Promise<void>;
  getWifiSsid(): Promise<{ ssid: string | null }>;
  checkPermissions(): Promise<NativePermissions>;
  requestPermissions(options: {
    permissions: ('location' | 'backgroundLocation' | 'notifications')[];
  }): Promise<NativePermissions>;
  isIgnoringBatteryOptimizations(): Promise<{ value: boolean }>;
  requestIgnoreBatteryOptimizations(): Promise<void>;
  openAppSettings(): Promise<void>;
  canPinWidget(): Promise<{ value: boolean }>;
  pinWidget(): Promise<void>;
  addListener(event: 'events', handler: () => void): Promise<PluginListenerHandle>;
}

export const PunchClock = registerPlugin<PunchClockPlugin>('PunchClock');
