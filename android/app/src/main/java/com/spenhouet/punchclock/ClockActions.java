package com.spenhouet.punchclock;

import android.content.Context;

/** Shared handling for stamps triggered natively (notification actions, Wi-Fi, automation). */
public final class ClockActions {

    private ClockActions() {}

    /**
     * Queue the event for the web layer, update the persisted state optimistically and bring the
     * service / notification and the home screen widget in line.
     *
     * @return false if the foreground service should run but could not be started
     */
    public static boolean perform(Context context, String action, long at, String source) {
        Context app = context.getApplicationContext();
        ClockState.applyAction(app, action, at);
        ClockState.queueEvent(app, action, at, source);
        boolean started = ClockService.refresh(app);
        ClockWidgetProvider.updateAll(app);
        return started;
    }
}
