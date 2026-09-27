package com.spenhouet.punchclock;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.util.Log;
import android.util.SizeF;
import android.view.View;
import android.widget.RemoteViews;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/** Home screen widget: status, live timer, balance and clock in / break / clock out buttons. */
public class ClockWidgetProvider extends AppWidgetProvider {

    private static final String TAG = "PunchClock";

    /** Widths (dp) from which the wide layout is used; below that the compact one. */
    private static final float WIDE_MIN_WIDTH = 260f;
    private static final float COMPACT_MIN_WIDTH = 110f;
    private static final float MIN_HEIGHT = 40f;

    /** PendingIntent request codes, distinct from the ones the notifications use. */
    private static final int RC_IN = 5301;
    private static final int RC_BREAK = 5302;
    private static final int RC_RESUME = 5303;
    private static final int RC_OUT = 5304;

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        update(context, manager, appWidgetIds);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int appWidgetId, Bundle newOptions) {
        // Below Android 12 the layout is picked from the reported size
        update(context, manager, new int[] { appWidgetId });
    }

    /** Re-render every placed widget from the persisted clock state. */
    public static void updateAll(Context context) {
        Context app = context.getApplicationContext();
        AppWidgetManager manager = AppWidgetManager.getInstance(app);
        if (manager == null) return;
        int[] ids;
        try {
            ids = manager.getAppWidgetIds(new ComponentName(app, ClockWidgetProvider.class));
        } catch (RuntimeException e) {
            Log.w(TAG, "widget ids unavailable", e);
            return;
        }
        if (ids == null || ids.length == 0) return;
        update(app, manager, ids);
    }

    private static void update(Context context, AppWidgetManager manager, int[] ids) {
        ClockState s = ClockState.load(context);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            Map<SizeF, RemoteViews> layouts = new HashMap<>();
            layouts.put(new SizeF(COMPACT_MIN_WIDTH, MIN_HEIGHT), build(context, s, false));
            layouts.put(new SizeF(WIDE_MIN_WIDTH, MIN_HEIGHT), build(context, s, true));
            RemoteViews views = new RemoteViews(layouts);
            for (int id : ids) manager.updateAppWidget(id, views);
            return;
        }
        for (int id : ids) manager.updateAppWidget(id, build(context, s, isWide(manager, id)));
    }

    private static boolean isWide(AppWidgetManager manager, int id) {
        Bundle options = manager.getAppWidgetOptions(id);
        int minWidth = options == null ? 0 : options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
        return minWidth == 0 || minWidth >= WIDE_MIN_WIDTH;
    }

    private static RemoteViews build(Context context, ClockState s, boolean wide) {
        RemoteViews v = new RemoteViews(context.getPackageName(), wide ? R.layout.widget_clock_wide : R.layout.widget_clock_compact);
        v.setOnClickPendingIntent(android.R.id.background, Notifications.openApp(context));

        long now = System.currentTimeMillis();
        long elapsed = SystemClock.elapsedRealtime();
        boolean working = ClockState.WORKING.equals(s.status);
        boolean onBreak = ClockState.BREAK.equals(s.status);

        // Status
        int status = working ? R.string.notif_working : onBreak ? R.string.notif_on_break : R.string.widget_not_clocked_in;
        int dot = working ? R.drawable.widget_dot_working : onBreak ? R.drawable.widget_dot_break : R.drawable.widget_dot_out;
        v.setTextViewText(R.id.widget_status, context.getString(status));
        v.setImageViewResource(R.id.widget_dot, dot);

        // Timer
        if (working) {
            v.setChronometerCountDown(R.id.widget_timer, false);
            v.setChronometer(R.id.widget_timer, elapsed - s.workedAt(now), null, true);
        } else if (onBreak && s.plannedEnd > 0) {
            v.setChronometerCountDown(R.id.widget_timer, true);
            v.setChronometer(R.id.widget_timer, elapsed + (s.plannedEnd - now), null, true);
        } else if (onBreak) {
            v.setChronometerCountDown(R.id.widget_timer, false);
            v.setChronometer(R.id.widget_timer, elapsed - Math.max(0, now - s.since), null, true);
        } else {
            long worked = ClockState.sameDay(s.workedAt, now) ? s.workedMs : 0;
            v.setChronometerCountDown(R.id.widget_timer, false);
            v.setChronometer(R.id.widget_timer, elapsed - worked, null, false);
        }

        // Primary action: clock in or out
        String primaryAction = s.isClockedIn() ? "out" : "in";
        PendingIntent primary = Notifications.action(context, primaryAction, 0, 0, s.isClockedIn() ? RC_OUT : RC_IN);
        String primaryLabel = context.getString(s.isClockedIn() ? R.string.action_clock_out : R.string.action_clock_in);
        v.setOnClickPendingIntent(R.id.widget_primary, primary);

        if (!wide) {
            v.setImageViewResource(R.id.widget_primary, s.isClockedIn() ? R.drawable.ic_widget_stop : R.drawable.ic_widget_play);
            v.setContentDescription(R.id.widget_primary, primaryLabel);
            return v;
        }

        v.setTextViewText(R.id.widget_primary, primaryLabel);
        if (s.isClockedIn()) {
            String secondaryAction = working ? "break" : "resume";
            v.setViewVisibility(R.id.widget_secondary, View.VISIBLE);
            v.setTextViewText(R.id.widget_secondary, context.getString(working ? R.string.action_break : R.string.action_resume));
            v.setOnClickPendingIntent(
                R.id.widget_secondary,
                Notifications.action(context, secondaryAction, 0, 0, working ? RC_BREAK : RC_RESUME)
            );
        } else {
            v.setViewVisibility(R.id.widget_secondary, View.GONE);
        }

        // Balance
        if (s.hasBalance) {
            v.setViewVisibility(R.id.widget_balance, View.VISIBLE);
            v.setTextViewText(R.id.widget_balance, context.getString(R.string.widget_balance, formatMinutes(s.balanceMinutes)));
        } else {
            v.setViewVisibility(R.id.widget_balance, View.GONE);
        }
        return v;
    }

    /** Signed {@code H:MM}, matching the web layer ({@code +} for zero and up, U+2212 for negative). */
    static String formatMinutes(int minutes) {
        int abs = Math.abs(minutes);
        String sign = minutes < 0 ? "−" : "+";
        return String.format(Locale.ROOT, "%s%d:%02d", sign, abs / 60, abs % 60);
    }
}
