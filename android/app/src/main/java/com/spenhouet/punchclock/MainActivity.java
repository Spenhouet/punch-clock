package com.spenhouet.punchclock;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PunchClockPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
