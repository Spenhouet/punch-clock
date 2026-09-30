package com.spenhouet.punchclock;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.Network;
import android.os.Build;

/** Target of the PendingIntent Wi-Fi callback: fires when a Wi-Fi network becomes available. */
public class WifiReceiver extends BroadcastReceiver {

    private static final long DEBOUNCE_MS = 10 * 60_000L;

    @Override
    public void onReceive(Context context, Intent intent) {
        Context app = context.getApplicationContext();
        ClockState.Wifi w = ClockState.wifi(app);
        if (!w.active()) return;
        Network network = getNetwork(intent);
        // A registration re-delivers networks that were already connected; only react to new ones
        if (network != null && !ClockState.markNetworkSeen(app, network.getNetworkHandle())) return;
        final long connectedAt = System.currentTimeMillis();
        final PendingResult pending = goAsync();
        WifiHelper.querySsid(app, network, 5_000, (ssid) -> {
            try {
                handle(app, ssid, connectedAt);
            } finally {
                pending.finish();
            }
        });
    }

    @SuppressWarnings("deprecation")
    private static Network getNetwork(Intent intent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return intent.getParcelableExtra(ConnectivityManager.EXTRA_NETWORK, Network.class);
        }
        return intent.getParcelableExtra(ConnectivityManager.EXTRA_NETWORK);
    }

    private static void handle(Context app, String ssid, long at) {
        ClockState.Wifi w = ClockState.wifi(app);
        if (!w.matches(ssid)) return;
        if (ClockState.load(app).isClockedIn()) return;
        if (at - ClockState.lastConnectHandled(app) < DEBOUNCE_MS) return;
        ClockState.setLastConnectHandled(app, at);
        if (w.auto) {
            boolean started = ClockActions.perform(app, "in", at, ClockState.SOURCE_WIFI, ssid);
            if (!started || !ClockService.shouldRun(app)) {
                Notifications.postInfo(app, app.getString(R.string.wifi_clocked_in, Notifications.time(app, at), w.ssid));
            }
        } else {
            Notifications.postClockInPrompt(app, w.ssid, at);
        }
    }
}
