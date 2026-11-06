package com.guildclub.services;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {
    private static final int PERMISSION_REQUEST_CODE = 1001;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Request runtime permissions for Location and Camera at app launch
        checkAndRequestPermissions();

        if (this.bridge != null && this.bridge.getWebView() != null) {
            WebView webView = this.bridge.getWebView();
            
            // Clear stale webview disk/memory cache to ensure latest deployment is fetched
            webView.clearCache(true);
            
            WebSettings settings = webView.getSettings();
            settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setGeolocationEnabled(true);
            settings.setAllowFileAccess(true);
            settings.setAllowContentAccess(true);

            // Enable Cookie Manager and third-party cookies for REST session cookies
            CookieManager cookieManager = CookieManager.getInstance();
            cookieManager.setAcceptCookie(true);
            cookieManager.setAcceptThirdPartyCookies(webView, true);
        }
    }

    private void checkAndRequestPermissions() {
        List<String> permissions = new ArrayList<>();
        
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.ACCESS_FINE_LOCATION);
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.ACCESS_COARSE_LOCATION);
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.CAMERA);
        }
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_IMAGES) != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.READ_MEDIA_IMAGES);
            }
        } else {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.READ_EXTERNAL_STORAGE);
            }
        }

        if (!permissions.isEmpty()) {
            ActivityCompat.requestPermissions(this, permissions.toArray(new String[0]), PERMISSION_REQUEST_CODE);
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().clearCache(true);
        }
    }
}
