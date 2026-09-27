package com.spenhouet.punchclock;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Receives the notification and home screen widget action buttons. */
public class ActionReceiver extends BroadcastReceiver {

    static final String ACTION_PREFIX = "com.spenhouet.punchclock.action.";
    static final String EXTRA_ACTION = "action";
    static final String EXTRA_AT = "at";
    static final String EXTRA_CANCEL_ID = "cancelId";
    static final String DISMISS = "dismiss";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getStringExtra(EXTRA_ACTION);
        int cancelId = intent.getIntExtra(EXTRA_CANCEL_ID, 0);
        if (cancelId != 0) Notifications.cancel(context, cancelId);
        if (action == null || DISMISS.equals(action)) return;
        long at = intent.getLongExtra(EXTRA_AT, 0);
        if (at <= 0) at = System.currentTimeMillis();
        ClockActions.perform(context, action, at, ClockState.SOURCE_NOTIFICATION);
    }
}
