package com.spenhouet.punchclock;

import android.Manifest;
import android.annotation.SuppressLint;
import android.appwidget.AppWidgetManager;
import android.content.ActivityNotFoundException;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONException;

@CapacitorPlugin(
    name = "PunchClock",
    permissions = {
        @Permission(alias = PunchClockPlugin.LOCATION, strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION }),
        @Permission(alias = PunchClockPlugin.BACKGROUND_LOCATION, strings = { Manifest.permission.ACCESS_BACKGROUND_LOCATION }),
        @Permission(alias = PunchClockPlugin.NOTIFICATIONS, strings = { Manifest.permission.POST_NOTIFICATIONS })
    }
)
public class PunchClockPlugin extends Plugin {

    static final String LOCATION = "location";
    static final String BACKGROUND_LOCATION = "backgroundLocation";
    static final String NOTIFICATIONS = "notifications";

    private static WeakReference<PunchClockPlugin> current = new WeakReference<>(null);

    @Override
    public void load() {
        current = new WeakReference<>(this);
        Notifications.ensureChannels(getContext());
        WifiHelper.rearmUnlessOnTarget(getContext());
    }

    @Override
    protected void handleOnDestroy() {
        if (current.get() == this) current.clear();
    }

    /** Tell the web layer that new events are waiting in the queue. */
    static void emitEvents() {
        PunchClockPlugin p = current.get();
        if (p == null) return;
        new Handler(Looper.getMainLooper()).post(() -> p.notifyListeners("events", new JSObject()));
    }

    @PluginMethod
    public void sync(PluginCall call) {
        String status = call.getString("status", ClockState.OUT);
        if (!ClockState.WORKING.equals(status) && !ClockState.BREAK.equals(status)) status = ClockState.OUT;
        long since = getLong(call, "since");
        long workedMs = getLong(call, "workedMs");
        long plannedEnd = getLong(call, "plannedEnd");
        boolean notifications = Boolean.TRUE.equals(call.getBoolean("notifications", true));
        Context ctx = getContext();
        Double balance = call.getDouble("balanceMinutes");
        ClockState.save(ctx, status, since, workedMs, System.currentTimeMillis(), plannedEnd, notifications);
        if (!"break".equals(status)) ClockState.setWifiBreakAt(ctx, 0);
        ClockState.saveBalance(ctx, balance == null || balance.isNaN() ? null : (int) Math.round(balance));
        ClockService.refresh(ctx);
        // The widget is independent of the notification setting
        ClockWidgetProvider.updateAll(ctx);
        call.resolve();
    }

    /**
     * Read a number as long. PluginCall.getDouble returns null for values the
     * JSON parser stored as Long (every epoch-millisecond timestamp), so read
     * from the raw data instead.
     */
    private static long getLong(PluginCall call, String key) {
        return call.getData().optLong(key, 0);
    }

    @PluginMethod
    public void drainEvents(PluginCall call) {
        JSONArray events = ClockState.drainEvents(getContext());
        JSObject ret = new JSObject();
        try {
            ret.put("events", new JSArray(events.toString()));
        } catch (JSONException e) {
            ret.put("events", new JSArray());
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void configureWifi(PluginCall call) {
        Double grace = call.getDouble("graceMinutes");
        ClockState.saveWifi(
            getContext(),
            Boolean.TRUE.equals(call.getBoolean("enabled", false)),
            call.getString("ssid", ""),
            call.getString("mode", "ask"),
            Boolean.TRUE.equals(call.getBoolean("clockOutOnDisconnect", false)),
            grace == null ? 5 : grace.intValue()
        );
        ClockState.saveBreakWindow(
            getContext(),
            Boolean.TRUE.equals(call.getBoolean("breakWindow", false)),
            (int) getLong(call, "breakFromMinutes"),
            (int) getLong(call, "breakToMinutes")
        );
        WifiHelper.applyRegistration(getContext());
        ClockService.refresh(getContext());
        call.resolve();
    }

    @PluginMethod
    public void getWifiSsid(PluginCall call) {
        WifiHelper.querySsid(getContext(), null, 3_000, (ssid) -> {
            JSObject ret = new JSObject();
            ret.put("ssid", ssid == null ? JSObject.NULL : ssid);
            call.resolve(ret);
        });
    }

    // ---- permissions ----

    private PermissionState state(String alias) {
        if (NOTIFICATIONS.equals(alias) && Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return PermissionState.GRANTED;
        if (BACKGROUND_LOCATION.equals(alias) && Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return state(LOCATION);
        PermissionState s = getPermissionState(alias);
        return s == null || s == PermissionState.PROMPT_WITH_RATIONALE ? PermissionState.PROMPT : s;
    }

    private JSObject permissionResult() {
        JSObject ret = new JSObject();
        ret.put(LOCATION, state(LOCATION).toString());
        ret.put(BACKGROUND_LOCATION, state(BACKGROUND_LOCATION).toString());
        ret.put(NOTIFICATIONS, state(NOTIFICATIONS).toString());
        return ret;
    }

    @Override
    @PluginMethod
    public void checkPermissions(PluginCall call) {
        call.resolve(permissionResult());
    }

    private static List<String> requested(PluginCall call) {
        List<String> list = new ArrayList<>();
        JSArray arr = call.getArray("permissions");
        if (arr == null) {
            list.add(LOCATION);
            list.add(NOTIFICATIONS);
            return list;
        }
        for (int i = 0; i < arr.length(); i++) {
            String s = arr.optString(i, null);
            if (s != null) list.add(s);
        }
        return list;
    }

    @Override
    @PluginMethod
    public void requestPermissions(PluginCall call) {
        List<String> wanted = requested(call);
        List<String> now = new ArrayList<>();
        if (wanted.contains(LOCATION) && state(LOCATION) != PermissionState.GRANTED) now.add(LOCATION);
        if (
            wanted.contains(NOTIFICATIONS) &&
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            state(NOTIFICATIONS) != PermissionState.GRANTED
        ) now.add(NOTIFICATIONS);
        if (!now.isEmpty()) {
            requestPermissionForAliases(now.toArray(new String[0]), call, "foregroundPermsCallback");
            return;
        }
        requestBackgroundOrResolve(call);
    }

    @PermissionCallback
    private void foregroundPermsCallback(PluginCall call) {
        requestBackgroundOrResolve(call);
    }

    /** Background location must be asked for on its own, after foreground location is granted. */
    private void requestBackgroundOrResolve(PluginCall call) {
        if (
            requested(call).contains(BACKGROUND_LOCATION) &&
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
            state(LOCATION) == PermissionState.GRANTED &&
            state(BACKGROUND_LOCATION) != PermissionState.GRANTED
        ) {
            requestPermissionForAlias(BACKGROUND_LOCATION, call, "backgroundPermsCallback");
            return;
        }
        call.resolve(permissionResult());
    }

    @PermissionCallback
    private void backgroundPermsCallback(PluginCall call) {
        call.resolve(permissionResult());
    }

    // ---- battery / settings ----

    @PluginMethod
    public void isIgnoringBatteryOptimizations(PluginCall call) {
        PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        JSObject ret = new JSObject();
        ret.put("value", pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName()));
        call.resolve(ret);
    }

    @SuppressLint("BatteryLife")
    @PluginMethod
    public void requestIgnoreBatteryOptimizations(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
        intent.setData(Uri.parse("package:" + getContext().getPackageName()));
        try {
            getActivity().startActivity(intent);
        } catch (ActivityNotFoundException e) {
            try {
                getActivity().startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
            } catch (ActivityNotFoundException e2) {
                call.reject("Battery optimization settings not available");
                return;
            }
        }
        call.resolve();
    }

    /** Whether the launcher supports adding the widget from inside the app. */
    @PluginMethod
    public void canPinWidget(PluginCall call) {
        JSObject ret = new JSObject();
        AppWidgetManager manager = AppWidgetManager.getInstance(getContext());
        ret.put("value", Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && manager != null && manager.isRequestPinAppWidgetSupported());
        call.resolve(ret);
    }

    /** Ask the launcher to place the home screen widget; the system shows its own confirmation. */
    @PluginMethod
    public void pinWidget(PluginCall call) {
        AppWidgetManager manager = AppWidgetManager.getInstance(getContext());
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || manager == null || !manager.isRequestPinAppWidgetSupported()) {
            call.reject("unsupported");
            return;
        }
        manager.requestPinAppWidget(new ComponentName(getContext(), ClockWidgetProvider.class), null, null);
        call.resolve();
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        intent.setData(Uri.fromParts("package", getContext().getPackageName(), null));
        try {
            getActivity().startActivity(intent);
            call.resolve();
        } catch (ActivityNotFoundException e) {
            call.reject("App settings not available");
        }
    }
}
