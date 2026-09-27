package com.spenhouet.punchclock;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Restores the Wi-Fi trigger and the ongoing notification and the widget after reboot or app update. */
public class BootReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        String a = intent.getAction();
        if (!Intent.ACTION_BOOT_COMPLETED.equals(a) && !Intent.ACTION_MY_PACKAGE_REPLACED.equals(a)) return;
        WifiHelper.rearmUnlessOnTarget(context);
        ClockService.refresh(context);
        // Chronometer bases are relative to elapsedRealtime, which restarts at boot
        ClockWidgetProvider.updateAll(context);
    }
}
