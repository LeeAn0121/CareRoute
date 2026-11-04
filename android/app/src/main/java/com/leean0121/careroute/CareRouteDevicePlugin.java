package com.leean0121.careroute;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.Manifest;
import android.net.Uri;
import android.provider.Settings;
import androidx.core.content.ContextCompat;
import android.print.PrintManager;
import android.speech.RecognizerIntent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;

@CapacitorPlugin(name = "CareRouteDevice")
public class CareRouteDevicePlugin extends Plugin {
    @PluginMethod
    public void getLocationPermission(PluginCall call) {
        boolean precise = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        boolean approximate = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        call.resolve(new JSObject().put("status", precise ? "precise" : approximate ? "approximate" : "not-granted"));
    }

    @PluginMethod
    public void openPermissionSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()));
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception error) { call.reject("앱 설정을 열지 못했습니다.", error); }
    }
    @PluginMethod
    public void authorizeCalendar(PluginCall call) {
        startActivityForResult(call, new Intent(getContext(), CalendarAuthorizationActivity.class), "calendarResult");
    }

    @ActivityCallback
    private void calendarResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null) {
            call.reject(data != null && data.hasExtra("error") ? data.getStringExtra("error") : "Google 캘린더 연결이 취소되었습니다.");
            return;
        }
        call.resolve(new JSObject().put("accessToken", data.getStringExtra("accessToken")));
    }
    @PluginMethod
    public void print(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                PrintManager manager = (PrintManager) getContext().getSystemService(Context.PRINT_SERVICE);
                if (manager == null) { call.reject("Print service unavailable"); return; }
                manager.print("CareRoute", getBridge().getWebView().createPrintDocumentAdapter("CareRoute"), null);
                call.resolve();
            } catch (Exception error) { call.reject("Unable to open print service", error); }
        });
    }

    @PluginMethod
    public void recognizeSpeech(PluginCall call) {
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ko-KR");
        intent.putExtra(RecognizerIntent.EXTRA_PROMPT, "방문 기록을 말씀해 주세요");
        try { startActivityForResult(call, intent, "speechResult"); }
        catch (Exception error) { call.reject("기기에 음성 인식 서비스가 없습니다. 키보드로 입력해 주세요.", error); }
    }

    @ActivityCallback
    private void speechResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.resolve(new JSObject().put("text", "")); return;
        }
        ArrayList<String> matches = result.getData().getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
        call.resolve(new JSObject().put("text", matches == null || matches.isEmpty() ? "" : matches.get(0)));
    }
}
