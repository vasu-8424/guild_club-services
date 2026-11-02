package com.guildclub.services;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // BridgeActivity automatically wires BridgeWebChromeClient which supports:
        // 1. File chooser & Camera upload (input type="file" and capture)
        // 2. HTML5 Geolocation prompt & permissions
        // 3. Alerts, confirms, and console bridges
    }
}
