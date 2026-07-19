package com.duvan.pagoaldia;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeSecurityPlugin.class);
        registerPlugin(NativeWidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
