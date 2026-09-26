package com.spenhouet.punchclock;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Exported entry point for automation apps (Tasker, Home Assistant, adb):
 * {@code com.spenhouet.punchclock.CLOCK_IN}, {@code .CLOCK_OUT}, {@code .BREAK}, {@code .RESUME}.
 */
public class AutomationReceiver extends BroadcastReceiver {

    private static final String PREFIX = "com.spenhouet.punchclock.";

    @Override
    public void onReceive(Context context, Intent intent) {
        String a = intent.getAction();
        if (a == null || !a.startsWith(PREFIX)) return;
        String action;
        switch (a.substring(PREFIX.length())) {
            case "CLOCK_IN":
                action = "in";
                break;
            case "CLOCK_OUT":
                action = "out";
                break;
            case "BREAK":
                action = "break";
                break;
            case "RESUME":
                action = "resume";
                break;
            default:
                return;
        }
        ClockActions.perform(context, action, System.currentTimeMillis(), ClockState.SOURCE_NOTIFICATION);
    }
}
