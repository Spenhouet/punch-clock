package com.spenhouet.punchclock;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Build;
import android.text.format.DateFormat;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import java.util.Date;

/** Channels and builders for every notification the native side posts. */
public final class Notifications {

    public static final String CHANNEL_CLOCK = "clock";
    public static final String CHANNEL_WIFI = "wifi";

    public static final int ID_ONGOING = 4201;
    public static final int ID_WIFI_PROMPT = 4202;
    public static final int ID_WIFI_INFO = 4203;

    private static final int ACCENT = Color.parseColor("#0f766e");

    private Notifications() {}

    public static void ensureChannels(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm == null) return;
        NotificationChannel clock = new NotificationChannel(
            CHANNEL_CLOCK,
            context.getString(R.string.channel_clock_name),
            NotificationManager.IMPORTANCE_LOW
        );
        clock.setDescription(context.getString(R.string.channel_clock_description));
        clock.setSound(null, null);
        clock.enableVibration(false);
        clock.setShowBadge(false);
        nm.createNotificationChannel(clock);

        NotificationChannel wifi = new NotificationChannel(
            CHANNEL_WIFI,
            context.getString(R.string.channel_wifi_name),
            NotificationManager.IMPORTANCE_DEFAULT
        );
        wifi.setDescription(context.getString(R.string.channel_wifi_description));
        nm.createNotificationChannel(wifi);
    }

    public static String time(Context context, long ms) {
        return DateFormat.getTimeFormat(context).format(new Date(ms));
    }

    static PendingIntent openApp(Context context) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Broadcast to {@link ActionReceiver}; {@code at} of 0 means "when tapped". */
    static PendingIntent action(Context context, String action, long at, int cancelId) {
        Intent intent = new Intent(context, ActionReceiver.class);
        intent.setAction(ActionReceiver.ACTION_PREFIX + action);
        intent.putExtra(ActionReceiver.EXTRA_ACTION, action);
        intent.putExtra(ActionReceiver.EXTRA_AT, at);
        intent.putExtra(ActionReceiver.EXTRA_CANCEL_ID, cancelId);
        int requestCode = (action + ":" + cancelId).hashCode();
        return PendingIntent.getBroadcast(context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** The ongoing status notification (used by the foreground service and as fallback). */
    public static Notification status(Context context, ClockState s) {
        ensureChannels(context);
        NotificationCompat.Builder b = new NotificationCompat.Builder(context, CHANNEL_CLOCK)
            .setSmallIcon(R.drawable.ic_stat_punchclock)
            .setColor(ACCENT)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_STATUS)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .setContentIntent(openApp(context))
            .setShowWhen(true)
            .setUsesChronometer(true);

        if (ClockState.BREAK.equals(s.status)) {
            b.setContentTitle(context.getString(R.string.notif_on_break));
            if (s.plannedEnd > 0) {
                b.setChronometerCountDown(true).setWhen(s.plannedEnd);
                b.setContentText(context.getString(R.string.notif_until, time(context, s.plannedEnd)));
            } else {
                b.setWhen(s.since);
                b.setContentText(context.getString(R.string.notif_since, time(context, s.since)));
            }
            b.addAction(0, context.getString(R.string.action_resume), action(context, "resume", 0, 0));
        } else {
            b.setContentTitle(context.getString(R.string.notif_working));
            b.setWhen(s.chronometerBase());
            b.setContentText(context.getString(R.string.notif_since, time(context, s.since)));
            b.addAction(0, context.getString(R.string.action_break), action(context, "break", 0, 0));
        }
        b.addAction(0, context.getString(R.string.action_clock_out), action(context, "out", 0, 0));
        return b.build();
    }

    private static NotificationCompat.Builder wifiBase(Context context, String text) {
        ensureChannels(context);
        return new NotificationCompat.Builder(context, CHANNEL_WIFI)
            .setSmallIcon(R.drawable.ic_stat_punchclock)
            .setColor(ACCENT)
            .setContentTitle(context.getString(R.string.app_name))
            .setContentText(text)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
            .setAutoCancel(true)
            .setContentIntent(openApp(context))
            .setPriority(NotificationCompat.PRIORITY_DEFAULT);
    }

    public static void postInfo(Context context, String text) {
        notify(context, ID_WIFI_INFO, wifiBase(context, text).build());
    }

    public static void postClockInPrompt(Context context, String ssid, long at) {
        NotificationCompat.Builder b = wifiBase(context, context.getString(R.string.wifi_prompt_in, ssid))
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .addAction(0, context.getString(R.string.action_clock_in), action(context, "in", at, ID_WIFI_PROMPT))
            .addAction(0, context.getString(R.string.action_dismiss), action(context, ActionReceiver.DISMISS, 0, ID_WIFI_PROMPT));
        notify(context, ID_WIFI_PROMPT, b.build());
    }

    public static void postClockOutPrompt(Context context, String ssid, long at) {
        NotificationCompat.Builder b = wifiBase(context, context.getString(R.string.wifi_prompt_out, ssid, time(context, at)))
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .addAction(0, context.getString(R.string.action_clock_out), action(context, "out", at, ID_WIFI_PROMPT))
            .addAction(0, context.getString(R.string.action_dismiss), action(context, ActionReceiver.DISMISS, 0, ID_WIFI_PROMPT));
        notify(context, ID_WIFI_PROMPT, b.build());
    }

    public static boolean canPost(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true;
        return ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }

    public static void notify(Context context, int id, Notification n) {
        if (!canPost(context)) return;
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        try {
            nm.notify(id, n);
        } catch (SecurityException ignore) {}
    }

    public static void cancel(Context context, int id) {
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(id);
    }
}
