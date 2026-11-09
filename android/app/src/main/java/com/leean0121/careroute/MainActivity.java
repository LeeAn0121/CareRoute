package com.leean0121.careroute;

import com.getcapacitor.BridgeActivity;
import androidx.activity.EdgeToEdge;
import androidx.core.view.ViewCompat;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(CareRouteDevicePlugin.class);
        super.onCreate(savedInstanceState);
        // Android 15+ enforces this; explicitly enable it on older releases too.
        // Capacitor SystemBars remains the sole owner of WebView inset handling.
        EdgeToEdge.enable(this);
        ViewCompat.requestApplyInsets(getWindow().getDecorView());
    }
}
