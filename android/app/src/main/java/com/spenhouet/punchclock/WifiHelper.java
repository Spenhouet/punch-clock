package com.spenhouet.punchclock;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.net.TransportInfo;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

/** SSID lookup and the persistent PendingIntent network callback. */
public final class WifiHelper {

    private static final String TAG = "PunchClock";
    private static final int PI_WIFI = 3001;

    public interface SsidCallback {
        void onResult(@Nullable String ssid);
    }

    private WifiHelper() {}

    /** Strip quotes; null for unknown or empty SSIDs. */
    @Nullable
    public static String clean(@Nullable String ssid) {
        if (ssid == null) return null;
        String s = ssid.trim();
        if (s.length() >= 2 && s.startsWith("\"") && s.endsWith("\"")) s = s.substring(1, s.length() - 1);
        if (s.isEmpty() || s.equals(WifiManager.UNKNOWN_SSID) || s.equals("<unknown ssid>") || s.equals("0x")) return null;
        return s;
    }

    /** SSID carried by capabilities (API 29+; unredacted on 31+ only with FLAG_INCLUDE_LOCATION_INFO). */
    @Nullable
    public static String ssidFromCapabilities(@Nullable NetworkCapabilities caps) {
        if (caps == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return null;
        TransportInfo info = caps.getTransportInfo();
        if (info instanceof WifiInfo) return clean(((WifiInfo) info).getSSID());
        return null;
    }

    /** Legacy lookup of the currently connected Wi-Fi. */
    @SuppressWarnings("deprecation")
    @Nullable
    public static String ssidFromWifiManager(Context context) {
        try {
            WifiManager wm = (WifiManager) context.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wm == null) return null;
            WifiInfo info = wm.getConnectionInfo();
            return info == null ? null : clean(info.getSSID());
        } catch (SecurityException e) {
            return null;
        }
    }

    public static NetworkRequest wifiRequest() {
        return new NetworkRequest.Builder().addTransportType(NetworkCapabilities.TRANSPORT_WIFI).build();
    }

    /**
     * Resolve the SSID of {@code network} (or of any connected Wi-Fi when null). Always calls back
     * exactly once on the main thread.
     */
    public static void querySsid(Context context, @Nullable Network network, long timeoutMs, SsidCallback cb) {
        Context app = context.getApplicationContext();
        Handler main = new Handler(Looper.getMainLooper());
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            main.post(() -> cb.onResult(ssidFromWifiManager(app)));
            return;
        }
        ConnectivityManager cm = (ConnectivityManager) app.getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm == null) {
            main.post(() -> cb.onResult(null));
            return;
        }
        final boolean[] done = { false };
        final ConnectivityManager.NetworkCallback[] holder = new ConnectivityManager.NetworkCallback[1];
        Runnable finishNull = () -> {
            if (done[0]) return;
            done[0] = true;
            unregister(cm, holder[0]);
            cb.onResult(ssidFromWifiManager(app));
        };
        holder[0] = new ConnectivityManager.NetworkCallback(ConnectivityManager.NetworkCallback.FLAG_INCLUDE_LOCATION_INFO) {
            @Override
            public void onCapabilitiesChanged(@NonNull Network n, @NonNull NetworkCapabilities caps) {
                if (network != null && !network.equals(n)) return;
                String ssid = ssidFromCapabilities(caps);
                if (ssid == null) return;
                main.post(() -> {
                    if (done[0]) return;
                    done[0] = true;
                    main.removeCallbacks(finishNull);
                    unregister(cm, holder[0]);
                    cb.onResult(ssid);
                });
            }
        };
        try {
            cm.registerNetworkCallback(wifiRequest(), holder[0]);
        } catch (RuntimeException e) {
            Log.w(TAG, "ssid query failed", e);
            main.post(() -> cb.onResult(ssidFromWifiManager(app)));
            return;
        }
        main.postDelayed(finishNull, timeoutMs);
    }

    private static void unregister(ConnectivityManager cm, @Nullable ConnectivityManager.NetworkCallback cb) {
        if (cb == null) return;
        try {
            cm.unregisterNetworkCallback(cb);
        } catch (RuntimeException ignore) {}
    }

    // ---- persistent connect trigger ----

    private static PendingIntent wifiPendingIntent(Context context) {
        Intent intent = new Intent(context, WifiReceiver.class);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        // The system fills in EXTRA_NETWORK, so the intent has to be mutable
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) flags |= PendingIntent.FLAG_MUTABLE;
        return PendingIntent.getBroadcast(context, PI_WIFI, intent, flags);
    }

    /** Register or unregister the PendingIntent Wi-Fi callback according to the stored config. */
    public static void applyRegistration(Context context) {
        Context app = context.getApplicationContext();
        ConnectivityManager cm = (ConnectivityManager) app.getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm == null) return;
        PendingIntent pi = wifiPendingIntent(app);
        try {
            cm.unregisterNetworkCallback(pi);
        } catch (RuntimeException ignore) {}
        if (!ClockState.wifi(app).active()) {
            RearmJobService.cancel(app);
            return;
        }
        RearmJobService.schedule(app);
        // Networks already connected at registration time do not count as a new arrival
        try {
            for (Network n : cm.getAllNetworks()) {
                NetworkCapabilities caps = cm.getNetworkCapabilities(n);
                if (caps != null && caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) {
                    ClockState.markNetworkSeen(app, n.getNetworkHandle());
                }
            }
        } catch (RuntimeException ignore) {}
        try {
            cm.registerNetworkCallback(wifiRequest(), pi);
        } catch (RuntimeException e) {
            Log.w(TAG, "register wifi callback failed", e);
        }
    }

    /**
     * Arm the trigger again unless the phone is on the work Wi-Fi right now. Arming while
     * connected to it would only produce a delivery for a network that is already known.
     */
    public static void rearmUnlessOnTarget(Context context) {
        Context app = context.getApplicationContext();
        ClockState.Wifi w = ClockState.wifi(app);
        if (!w.active()) return;
        if (w.matches(ssidFromWifiManager(app))) return;
        applyRegistration(app);
    }
}
