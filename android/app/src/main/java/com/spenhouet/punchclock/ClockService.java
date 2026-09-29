package com.spenhouet.punchclock;

import android.app.Notification;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.annotation.RequiresApi;
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;
import java.util.HashMap;
import java.util.Map;

/**
 * Foreground service that shows the running clock and, when Wi-Fi auto clock-out is enabled,
 * watches for leaving the work Wi-Fi.
 */
public class ClockService extends Service {

    private static final String TAG = "PunchClock";

    @Nullable
    private static volatile ClockService instance;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private ConnectivityManager.NetworkCallback wifiCallback;
    private String monitoredSsid;
    /** SSID per connected Wi-Fi network, as seen by the in-process callback. */
    private final Map<Network, String> networks = new HashMap<>();
    private boolean onTarget = false;
    private long lossTime = 0;
    private final Runnable graceCheck = this::onGraceExpired;
    private final Runnable breakWindowCheck = this::onBreakWindowOver;

    /** Whether the service should be running for the given state. */
    static boolean shouldRun(Context context) {
        ClockState s = ClockState.load(context);
        if (!s.isClockedIn()) return false;
        return s.notifications || ClockState.wifi(context).monitorDisconnect();
    }

    /**
     * Start, update or stop the service to match the persisted state.
     *
     * @return false when the service should run but could not be started (background start
     *     restrictions); a plain notification is posted instead in that case.
     */
    public static boolean refresh(Context context) {
        Context app = context.getApplicationContext();
        ClockService running = instance;
        if (!shouldRun(app)) {
            if (running != null) running.shutdown();
            Notifications.cancel(app, Notifications.ID_ONGOING);
            return true;
        }
        if (running != null) {
            running.update();
            return true;
        }
        try {
            ContextCompat.startForegroundService(app, new Intent(app, ClockService.class));
            return true;
        } catch (IllegalStateException | SecurityException e) {
            // ForegroundServiceStartNotAllowedException (API 31+) extends IllegalStateException
            Log.w(TAG, "cannot start foreground service from background", e);
            Notifications.notify(app, Notifications.ID_ONGOING, Notifications.status(app, ClockState.load(app)));
            return false;
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // Always enter the foreground first; startForegroundService requires it.
        if (!enterForeground()) {
            stopSelf();
            return START_NOT_STICKY;
        }
        if (!shouldRun(this)) {
            shutdown();
            return START_NOT_STICKY;
        }
        updateWifiMonitor();
        return START_STICKY;
    }

    private boolean enterForeground() {
        Notification n = Notifications.status(this, ClockState.load(this));
        try {
            if (Build.VERSION.SDK_INT >= 34) {
                ServiceCompat.startForeground(this, Notifications.ID_ONGOING, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
            } else {
                startForeground(Notifications.ID_ONGOING, n);
            }
            return true;
        } catch (IllegalStateException | SecurityException e) {
            Log.w(TAG, "startForeground not allowed", e);
            Notifications.notify(this, Notifications.ID_ONGOING, n);
            return false;
        }
    }

    /** Re-render the notification and re-evaluate the Wi-Fi monitor. */
    void update() {
        if (!shouldRun(this)) {
            shutdown();
            return;
        }
        Notifications.notify(this, Notifications.ID_ONGOING, Notifications.status(this, ClockState.load(this)));
        updateWifiMonitor();
    }

    void shutdown() {
        stopWifiMonitor();
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        stopSelf();
        Notifications.cancel(this, Notifications.ID_ONGOING);
    }

    @Override
    public void onDestroy() {
        stopWifiMonitor();
        if (instance == this) instance = null;
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    // ---- Wi-Fi auto clock-out ----

    private void updateWifiMonitor() {
        ClockState.Wifi w = ClockState.wifi(this);
        if (!w.monitorDisconnect()) {
            stopWifiMonitor();
            return;
        }
        if (wifiCallback != null && w.ssid.equals(monitoredSsid)) return;
        stopWifiMonitor();
        startWifiMonitor(w.ssid);
    }

    private void startWifiMonitor(String ssid) {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm == null) return;
        monitoredSsid = ssid;
        networks.clear();
        onTarget = false;
        lossTime = 0;
        ConnectivityManager.NetworkCallback cb = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
            ? new Callback(ConnectivityManager.NetworkCallback.FLAG_INCLUDE_LOCATION_INFO)
            : new Callback();
        try {
            cm.registerNetworkCallback(WifiHelper.wifiRequest(), cb);
            wifiCallback = cb;
        } catch (RuntimeException e) {
            Log.w(TAG, "wifi monitor failed", e);
        }
        scheduleBreakWindowCheck();
    }

    private void stopWifiMonitor() {
        handler.removeCallbacks(graceCheck);
        handler.removeCallbacks(breakWindowCheck);
        if (wifiCallback != null) {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            try {
                if (cm != null) cm.unregisterNetworkCallback(wifiCallback);
            } catch (RuntimeException ignore) {}
        }
        wifiCallback = null;
        monitoredSsid = null;
        networks.clear();
        onTarget = false;
        lossTime = 0;
    }

    private class Callback extends ConnectivityManager.NetworkCallback {

        Callback() {
            super();
        }

        @RequiresApi(Build.VERSION_CODES.S)
        Callback(int flags) {
            super(flags);
        }

        @Override
        public void onCapabilitiesChanged(@NonNull Network network, @NonNull NetworkCapabilities caps) {
            String ssid = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                ? WifiHelper.ssidFromCapabilities(caps)
                : WifiHelper.ssidFromWifiManager(ClockService.this);
            handler.post(() -> {
                if (wifiCallback != this) return;
                if (ssid != null) networks.put(network, ssid);
                evaluate();
            });
        }

        @Override
        public void onLost(@NonNull Network network) {
            handler.post(() -> {
                if (wifiCallback != this) return;
                networks.remove(network);
                evaluate();
            });
        }
    }

    private void evaluate() {
        boolean now = monitoredSsid != null && networks.containsValue(monitoredSsid);
        if (now == onTarget) return;
        onTarget = now;
        if (now) {
            // Back within the grace period
            handler.removeCallbacks(graceCheck);
            lossTime = 0;
            onReturn();
        } else {
            lossTime = System.currentTimeMillis();
            // The connect trigger fires only once per arming; arm it for the next arrival
            WifiHelper.applyRegistration(this);
            int grace = ClockState.wifi(this).graceMinutes;
            handler.removeCallbacks(graceCheck);
            handler.postDelayed(graceCheck, grace * 60_000L);
        }
    }

    private void onGraceExpired() {
        if (onTarget || lossTime == 0) return;
        ClockState s = ClockState.load(this);
        ClockState.Wifi w = ClockState.wifi(this);
        if (!s.isClockedIn() || !w.monitorDisconnect()) return;
        long at = lossTime;
        lossTime = 0;
        if (s.isWorking() && w.inBreakWindow(at)) {
            // Leaving during the usual break time is a break, not the end of the day
            if (w.auto) {
                ClockActions.perform(this, "break", at, ClockState.SOURCE_WIFI);
                ClockState.setWifiBreakAt(this, at);
                Notifications.postInfo(this, getString(R.string.wifi_break_started, Notifications.time(this, at), w.ssid));
                scheduleBreakWindowCheck();
            } else {
                Notifications.postBreakPrompt(this, w.ssid, at);
            }
            return;
        }
        if (s.isOnBreak() && w.inBreakWindow(at)) {
            // Left while on a break taken by hand: keep it, and treat it like a Wi-Fi break
            ClockState.setWifiBreakAt(this, at);
            scheduleBreakWindowCheck();
            return;
        }
        // Already on a break the Wi-Fi started; the window check decides what happens next
        if (ClockState.wifiBreakAt(this) > 0) return;
        if (w.auto) {
            ClockActions.perform(this, "out", at, ClockState.SOURCE_WIFI);
            Notifications.postInfo(this, getString(R.string.wifi_clocked_out, Notifications.time(this, at), w.ssid));
        } else {
            Notifications.postClockOutPrompt(this, w.ssid, at);
        }
    }

    /** Back on the work Wi-Fi: end a break that leaving it started. */
    private void onReturn() {
        long breakAt = ClockState.wifiBreakAt(this);
        if (breakAt <= 0 || !ClockState.load(this).isOnBreak()) return;
        handler.removeCallbacks(breakWindowCheck);
        ClockState.Wifi w = ClockState.wifi(this);
        long at = System.currentTimeMillis();
        if (w.auto) {
            ClockActions.perform(this, "resume", at, ClockState.SOURCE_WIFI);
            Notifications.postInfo(this, getString(R.string.wifi_break_ended, Notifications.time(this, at)));
        } else {
            ClockState.setWifiBreakAt(this, 0);
            Notifications.postResumePrompt(this, w.ssid, at);
        }
    }

    private void scheduleBreakWindowCheck() {
        handler.removeCallbacks(breakWindowCheck);
        long breakAt = ClockState.wifiBreakAt(this);
        if (breakAt <= 0) return;
        ClockState.Wifi w = ClockState.wifi(this);
        long due = w.breakWindowEnd(breakAt) + w.graceMinutes * 60_000L;
        handler.postDelayed(breakWindowCheck, Math.max(0, due - System.currentTimeMillis()));
    }

    /**
     * Still away when the usual break time is over: that was the end of the day, so clock out at
     * the time the Wi-Fi was lost, which drops the break.
     */
    private void onBreakWindowOver() {
        long breakAt = ClockState.wifiBreakAt(this);
        if (breakAt <= 0 || onTarget || !ClockState.load(this).isOnBreak()) return;
        ClockState.Wifi w = ClockState.wifi(this);
        if (w.auto) {
            ClockActions.perform(this, "out", breakAt, ClockState.SOURCE_WIFI);
            Notifications.postInfo(this, getString(R.string.wifi_break_timeout, Notifications.time(this, breakAt)));
        } else {
            ClockState.setWifiBreakAt(this, 0);
            Notifications.postClockOutPrompt(this, w.ssid, breakAt);
        }
    }
}
