package com.leean0121.careroute;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(CareRouteDevicePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
