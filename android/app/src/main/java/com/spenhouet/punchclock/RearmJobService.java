package com.spenhouet.punchclock;

import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
import android.util.Log;

/**
 * Backstop for the Wi-Fi trigger. The system releases a PendingIntent network
 * callback a few seconds after it fires, so the trigger has to be armed again
 * once the phone has left the work Wi-Fi. ClockService does that right away
 * while clocked in; this job covers the rest (e.g. clocked out by hand while
 * still connected) every 15 minutes.
 */
public class RearmJobService extends JobService {

    private static final String TAG = "PunchClock";
    private static final int JOB_ID = 4201;

    public static void schedule(Context context) {
        JobScheduler js = context.getSystemService(JobScheduler.class);
        // Rescheduling an existing periodic job restarts it and can run it right away, which
        // would re-arm, reschedule and run again in a loop
        if (js == null || js.getPendingJob(JOB_ID) != null) return;
        JobInfo job = new JobInfo.Builder(JOB_ID, new ComponentName(context, RearmJobService.class))
            .setPeriodic(15 * 60_000L)
            .setPersisted(true)
            .build();
        try {
            js.schedule(job);
        } catch (RuntimeException e) {
            Log.w(TAG, "rearm job not scheduled", e);
        }
    }

    public static void cancel(Context context) {
        JobScheduler js = context.getSystemService(JobScheduler.class);
        if (js != null) js.cancel(JOB_ID);
    }

    @Override
    public boolean onStartJob(JobParameters params) {
        WifiHelper.rearmUnlessOnTarget(getApplicationContext());
        return false;
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        return false;
    }
}
