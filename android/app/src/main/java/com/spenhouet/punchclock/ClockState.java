package com.spenhouet.punchclock;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;
import java.util.Calendar;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Persisted mirror of the clock state plus the queue of events recorded natively
 * (notification buttons, Wi-Fi triggers, automation intents) for the web layer to apply.
 */
public final class ClockState {

    private static final String TAG = "PunchClock";
    private static final String PREFS = "punchclock_native";
    private static final Object QUEUE_LOCK = new Object();

    public static final String OUT = "out";
    public static final String WORKING = "working";
    public static final String BREAK = "break";

    public static final String SOURCE_WIFI = "wifi";
    public static final String SOURCE_NOTIFICATION = "notification";

    private static final String K_STATUS = "status";
    private static final String K_SINCE = "since";
    /** Work time today, measured at {@link #K_WORKED_AT}. */
    private static final String K_WORKED_MS = "workedMs";
    private static final String K_WORKED_AT = "workedAt";
    private static final String K_PLANNED_END = "plannedEnd";
    private static final String K_NOTIFICATIONS = "notifications";
    private static final String K_HAS_BALANCE = "hasBalance";
    private static final String K_BALANCE_MINUTES = "balanceMinutes";
    private static final String K_EVENTS = "events";

    private static final String K_WIFI_ENABLED = "wifiEnabled";
    private static final String K_WIFI_SSID = "wifiSsid";
    private static final String K_WIFI_MODE = "wifiMode";
    private static final String K_WIFI_CLOCK_OUT = "wifiClockOut";
    private static final String K_WIFI_GRACE = "wifiGraceMinutes";
    private static final String K_WIFI_BREAK_WINDOW = "wifiBreakWindow";
    private static final String K_WIFI_BREAK_FROM = "wifiBreakFrom";
    private static final String K_WIFI_BREAK_TO = "wifiBreakTo";
    /** Loss time of a break that leaving the Wi-Fi started; 0 when the current break isn't one. */
    private static final String K_WIFI_BREAK_AT = "wifiBreakAt";
    private static final String K_LAST_CONNECT = "wifiLastConnectHandled";
    private static final String K_SEEN_NETWORKS = "wifiSeenNetworks";

    public final String status;
    public final long since;
    public final long workedMs;
    public final long workedAt;
    public final long plannedEnd;
    public final boolean notifications;
    /** Whether {@link #balanceMinutes} was provided by the web layer. */
    public final boolean hasBalance;
    /** Overtime balance in minutes at the last sync. */
    public final int balanceMinutes;

    private ClockState(SharedPreferences p) {
        status = p.getString(K_STATUS, OUT);
        since = p.getLong(K_SINCE, 0);
        workedMs = p.getLong(K_WORKED_MS, 0);
        workedAt = p.getLong(K_WORKED_AT, 0);
        plannedEnd = p.getLong(K_PLANNED_END, 0);
        notifications = p.getBoolean(K_NOTIFICATIONS, true);
        hasBalance = p.getBoolean(K_HAS_BALANCE, false);
        balanceMinutes = p.getInt(K_BALANCE_MINUTES, 0);
    }

    static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static ClockState load(Context context) {
        return new ClockState(prefs(context));
    }

    public boolean isClockedIn() {
        return !OUT.equals(status);
    }

    public boolean isWorking() {
        return WORKING.equals(status);
    }

    public boolean isOnBreak() {
        return BREAK.equals(status);
    }

    /** Work time today at {@code at}, counting the running work segment. */
    public long workedAt(long at) {
        if (WORKING.equals(status)) return workedMs + Math.max(0, at - workedAt);
        return workedMs;
    }

    /** Virtual start for a chronometer that shows today's total work time. */
    public long chronometerBase() {
        return workedAt - workedMs;
    }

    public static void save(Context context, String status, long since, long workedMs, long workedAt, long plannedEnd, boolean notifications) {
        prefs(context)
            .edit()
            .putString(K_STATUS, status)
            .putLong(K_SINCE, since)
            .putLong(K_WORKED_MS, workedMs)
            .putLong(K_WORKED_AT, workedAt)
            .putLong(K_PLANNED_END, plannedEnd)
            .putBoolean(K_NOTIFICATIONS, notifications)
            .commit();
    }

    /** Store the overtime balance shown on the widget; {@code null} clears it. */
    public static void saveBalance(Context context, Integer minutes) {
        prefs(context)
            .edit()
            .putBoolean(K_HAS_BALANCE, minutes != null)
            .putInt(K_BALANCE_MINUTES, minutes == null ? 0 : minutes)
            .commit();
    }

    /** Apply an action to the persisted state optimistically (the web layer corrects on next sync). */
    public static void applyAction(Context context, String action, long at) {
        // Any stamp other than a break ends a break that leaving the Wi-Fi started
        if (!"break".equals(action)) setWifiBreakAt(context, 0);
        ClockState s = load(context);
        long worked = s.workedAt(at);
        switch (action) {
            case "in":
                if (s.isClockedIn()) return;
                // Keep work already done today; a new day starts from zero
                long keep = sameDay(s.workedAt, at) ? s.workedMs : 0;
                save(context, WORKING, at, keep, at, 0, s.notifications);
                break;
            case "out":
                save(context, OUT, at, worked, at, 0, s.notifications);
                break;
            case "break":
                save(context, BREAK, at, worked, at, 0, s.notifications);
                break;
            case "resume":
                save(context, WORKING, at, worked, at, 0, s.notifications);
                break;
            default:
                break;
        }
    }

    static boolean sameDay(long a, long b) {
        if (a <= 0) return false;
        Calendar ca = Calendar.getInstance();
        ca.setTimeInMillis(a);
        Calendar cb = Calendar.getInstance();
        cb.setTimeInMillis(b);
        return ca.get(Calendar.YEAR) == cb.get(Calendar.YEAR) && ca.get(Calendar.DAY_OF_YEAR) == cb.get(Calendar.DAY_OF_YEAR);
    }

    // ---- Event queue ----

    public static void queueEvent(Context context, String action, long at, String source) {
        synchronized (QUEUE_LOCK) {
            SharedPreferences p = prefs(context);
            JSONArray arr = parse(p.getString(K_EVENTS, "[]"));
            try {
                JSONObject e = new JSONObject();
                e.put("action", action);
                e.put("at", at);
                e.put("source", source);
                arr.put(e);
            } catch (JSONException ex) {
                Log.e(TAG, "queue event", ex);
                return;
            }
            p.edit().putString(K_EVENTS, arr.toString()).commit();
        }
        PunchClockPlugin.emitEvents();
    }

    public static JSONArray drainEvents(Context context) {
        synchronized (QUEUE_LOCK) {
            SharedPreferences p = prefs(context);
            JSONArray arr = parse(p.getString(K_EVENTS, "[]"));
            p.edit().putString(K_EVENTS, "[]").commit();
            return arr;
        }
    }

    private static JSONArray parse(String s) {
        try {
            return new JSONArray(s);
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    // ---- Wi-Fi config ----

    public static final class Wifi {

        public final boolean enabled;
        public final String ssid;
        public final boolean auto;
        public final boolean clockOutOnDisconnect;
        public final int graceMinutes;
        /** Leaving the Wi-Fi inside this daily window starts a break instead of clocking out. */
        public final boolean breakWindow;
        /** Minutes after midnight. */
        public final int breakFrom;
        public final int breakTo;

        Wifi(SharedPreferences p) {
            breakWindow = p.getBoolean(K_WIFI_BREAK_WINDOW, false);
            breakFrom = p.getInt(K_WIFI_BREAK_FROM, 12 * 60);
            breakTo = p.getInt(K_WIFI_BREAK_TO, 13 * 60 + 30);
            enabled = p.getBoolean(K_WIFI_ENABLED, false);
            ssid = p.getString(K_WIFI_SSID, "");
            auto = "auto".equals(p.getString(K_WIFI_MODE, "ask"));
            clockOutOnDisconnect = p.getBoolean(K_WIFI_CLOCK_OUT, false);
            graceMinutes = p.getInt(K_WIFI_GRACE, 5);
        }

        public boolean active() {
            return enabled && ssid != null && !ssid.isEmpty();
        }

        public boolean monitorDisconnect() {
            return active() && clockOutOnDisconnect;
        }

        public boolean matches(String other) {
            return other != null && active() && ssid.equals(other);
        }

        /** Whether {@code ts} falls into the usual break window (local time of day). */
        public boolean inBreakWindow(long ts) {
            if (!breakWindow || breakFrom == breakTo) return false;
            int m = minuteOfDay(ts);
            return breakFrom < breakTo ? m >= breakFrom && m < breakTo : m >= breakFrom || m < breakTo;
        }

        /** End of the break window that contains {@code ts}, as a timestamp. */
        public long breakWindowEnd(long ts) {
            Calendar c = Calendar.getInstance();
            c.setTimeInMillis(ts);
            c.set(Calendar.HOUR_OF_DAY, breakTo / 60);
            c.set(Calendar.MINUTE, breakTo % 60);
            c.set(Calendar.SECOND, 0);
            c.set(Calendar.MILLISECOND, 0);
            if (c.getTimeInMillis() <= ts) c.add(Calendar.DAY_OF_YEAR, 1);
            return c.getTimeInMillis();
        }
    }

    public static Wifi wifi(Context context) {
        return new Wifi(prefs(context));
    }

    static int minuteOfDay(long ts) {
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(ts);
        return c.get(Calendar.HOUR_OF_DAY) * 60 + c.get(Calendar.MINUTE);
    }

    public static void saveBreakWindow(Context context, boolean enabled, int from, int to) {
        prefs(context)
            .edit()
            .putBoolean(K_WIFI_BREAK_WINDOW, enabled)
            .putInt(K_WIFI_BREAK_FROM, Math.max(0, Math.min(24 * 60 - 1, from)))
            .putInt(K_WIFI_BREAK_TO, Math.max(0, Math.min(24 * 60, to)))
            .commit();
    }

    public static long wifiBreakAt(Context context) {
        return prefs(context).getLong(K_WIFI_BREAK_AT, 0);
    }

    public static void setWifiBreakAt(Context context, long at) {
        prefs(context).edit().putLong(K_WIFI_BREAK_AT, at).commit();
    }

    public static void saveWifi(Context context, boolean enabled, String ssid, String mode, boolean clockOut, int graceMinutes) {
        prefs(context)
            .edit()
            .putBoolean(K_WIFI_ENABLED, enabled)
            .putString(K_WIFI_SSID, ssid == null ? "" : ssid)
            .putString(K_WIFI_MODE, mode == null ? "ask" : mode)
            .putBoolean(K_WIFI_CLOCK_OUT, clockOut)
            .putInt(K_WIFI_GRACE, Math.max(0, graceMinutes))
            .commit();
    }

    public static long lastConnectHandled(Context context) {
        return prefs(context).getLong(K_LAST_CONNECT, 0);
    }

    public static void setLastConnectHandled(Context context, long at) {
        prefs(context).edit().putLong(K_LAST_CONNECT, at).commit();
    }

    /**
     * Remember a network handle. Returns true when it had not been seen before, so a registration
     * that re-delivers an already connected network does not count as a fresh connect.
     */
    public static synchronized boolean markNetworkSeen(Context context, long handle) {
        SharedPreferences p = prefs(context);
        JSONArray arr = parse(p.getString(K_SEEN_NETWORKS, "[]"));
        for (int i = 0; i < arr.length(); i++) {
            if (arr.optLong(i) == handle) return false;
        }
        JSONArray next = new JSONArray();
        for (int i = Math.max(0, arr.length() - 9); i < arr.length(); i++) next.put(arr.optLong(i));
        next.put(handle);
        p.edit().putString(K_SEEN_NETWORKS, next.toString()).commit();
        return true;
    }
}
