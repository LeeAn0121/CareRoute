package com.leean0121.careroute;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.appupdate.AppUpdateOptions;
import com.google.android.play.core.install.InstallStateUpdatedListener;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.InstallStatus;
import com.google.android.play.core.install.model.UpdateAvailability;
import java.util.HashMap;
import java.util.Map;

/** Play availability is authoritative; website releases never imply a Play rollout. */
@CapacitorPlugin(name = "CareRouteUpdates")
public class CareRouteUpdatesPlugin extends Plugin {
    private AppUpdateManager manager;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Map<PluginCall, Runnable> pending = new HashMap<>();
    private boolean destroyed;
    private boolean listening;
    private boolean flowBusy;
    private boolean completing;
    private int versionCode;
    private boolean available;
    private boolean flexibleAllowed;
    private final InstallStateUpdatedListener installListener = state -> {
        if (destroyed) return;
        if (state.installStatus() == InstallStatus.INSTALLED) available = false;
        notifyListeners("updateState", payload(state.installStatus()));
    };

    @Override
    public void load() {
        manager = AppUpdateManagerFactory.create(getContext());
        listen();
    }

    private void listen() {
        if (!destroyed && !listening) {
            manager.registerListener(installListener);
            listening = true;
        }
    }

    private String status(int value) {
        switch (value) {
            case InstallStatus.PENDING: return "pending";
            case InstallStatus.DOWNLOADING: return "downloading";
            case InstallStatus.DOWNLOADED: return "downloaded";
            case InstallStatus.INSTALLING: return "installing";
            case InstallStatus.INSTALLED: return "installed";
            case InstallStatus.CANCELED: return "canceled";
            case InstallStatus.FAILED: return "failed";
            default: return "idle";
        }
    }

    private JSObject payload(int installStatus) {
        return new JSObject().put("available", available)
            .put("flexibleAllowed", flexibleAllowed)
            .put("versionCode", versionCode)
            .put("installStatus", status(installStatus));
    }

    private JSObject snapshot(AppUpdateInfo info) {
        versionCode = info.availableVersionCode();
        available = info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE;
        flexibleAllowed = info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE);
        return payload(info.installStatus());
    }

    // Calls and deadlines are confined to the UI thread. Late tasks cannot settle twice.
    private boolean begin(PluginCall call, long timeout) {
        return begin(call, timeout, () -> {});
    }

    private boolean begin(PluginCall call, long timeout, Runnable onTimeout) {
        if (destroyed) { call.reject("업데이트 화면이 종료되었습니다."); return false; }
        Runnable deadline = () -> {
            if (pending.remove(call) != null) {
                onTimeout.run();
                call.reject("업데이트 응답 시간이 초과되었습니다.");
            }
        };
        pending.put(call, deadline);
        handler.postDelayed(deadline, timeout);
        return true;
    }

    private boolean take(PluginCall call) {
        Runnable deadline = pending.remove(call);
        if (deadline == null || destroyed) return false;
        handler.removeCallbacks(deadline);
        return true;
    }

    private void reject(PluginCall call, String message) {
        if (take(call)) call.reject(message);
    }

    @PluginMethod
    public void getUpdateInfo(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (!begin(call, 10000)) return;
            manager.getAppUpdateInfo()
                .addOnSuccessListener(info -> { if (take(call)) call.resolve(snapshot(info)); })
                .addOnFailureListener(error -> reject(call, "Google Play 업데이트를 확인하지 못했습니다."));
        });
    }

    @PluginMethod
    public void startUpdate(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (flowBusy || completing) { call.reject("업데이트가 이미 진행 중입니다."); return; }
            if (getActivity().isFinishing() || getActivity().isDestroyed()) {
                call.reject("앱을 연 상태에서 다시 시도해주세요."); return;
            }
            if (!begin(call, 120000, () -> flowBusy = false)) return;
            flowBusy = true;
            // A fresh AppUpdateInfo is required for every consent attempt.
            manager.getAppUpdateInfo().addOnSuccessListener(info -> {
                if (!pending.containsKey(call) || destroyed) return;
                snapshot(info);
                if (!available || !flexibleAllowed) {
                    flowBusy = false;
                    if (take(call)) call.resolve(new JSObject().put("status", "unavailable"));
                    return;
                }
                listen();
                try {
                    manager.startUpdateFlow(info, getActivity(), AppUpdateOptions.newBuilder(AppUpdateType.FLEXIBLE).build())
                        .addOnSuccessListener(result -> {
                            if (!take(call)) return;
                            flowBusy = false;
                            if (result == Activity.RESULT_OK) call.resolve(new JSObject().put("status", "accepted"));
                            else if (result == Activity.RESULT_CANCELED) call.resolve(new JSObject().put("status", "canceled"));
                            else call.reject("Google Play 업데이트를 시작하지 못했습니다.");
                        })
                        .addOnFailureListener(error -> {
                            if (!pending.containsKey(call) || destroyed) return;
                            flowBusy = false;
                            reject(call, "Google Play 업데이트를 시작하지 못했습니다.");
                        });
                } catch (RuntimeException error) {
                    flowBusy = false;
                    reject(call, "Google Play 업데이트를 시작하지 못했습니다.");
                }
            }).addOnFailureListener(error -> {
                if (!pending.containsKey(call) || destroyed) return;
                flowBusy = false;
                reject(call, "Google Play 업데이트를 확인하지 못했습니다.");
            });
        });
    }

    @PluginMethod
    public void completeUpdate(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (flowBusy || completing) { call.reject("업데이트가 이미 진행 중입니다."); return; }
            if (!begin(call, 10000, () -> completing = false)) return;
            completing = true;
            manager.getAppUpdateInfo().addOnSuccessListener(info -> {
                if (!pending.containsKey(call) || destroyed) return;
                if (info.installStatus() != InstallStatus.DOWNLOADED) {
                    completing = false;
                    reject(call, "아직 설치할 업데이트가 준비되지 않았습니다.");
                    return;
                }
                manager.completeUpdate().addOnSuccessListener(unused -> {
                    if (!pending.containsKey(call) || destroyed) return;
                    completing = false;
                    if (take(call)) call.resolve();
                }).addOnFailureListener(error -> {
                    if (!pending.containsKey(call) || destroyed) return;
                    completing = false;
                    reject(call, "업데이트를 설치하지 못했습니다.");
                });
            }).addOnFailureListener(error -> {
                if (!pending.containsKey(call) || destroyed) return;
                completing = false;
                reject(call, "업데이트 설치 상태를 확인하지 못했습니다.");
            });
        });
    }

    @PluginMethod
    public void openStore(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (destroyed) { call.reject("업데이트 화면이 종료되었습니다."); return; }
            String packageName = getContext().getPackageName();
            try {
                getActivity().startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + packageName)).setPackage("com.android.vending"));
                call.resolve();
            } catch (ActivityNotFoundException unavailable) {
                try {
                    getActivity().startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=" + packageName)));
                    call.resolve();
                } catch (RuntimeException error) { call.reject("Google Play를 열지 못했습니다."); }
            } catch (RuntimeException error) { call.reject("Google Play를 열지 못했습니다."); }
        });
    }

    @Override
    protected void handleOnResume() {
        listen();
        notifyListeners("resume", new JSObject());
    }

    @Override
    protected void handleOnPause() {
        if (listening) manager.unregisterListener(installListener);
        listening = false;
    }

    @Override
    protected void handleOnDestroy() {
        destroyed = true;
        if (listening) manager.unregisterListener(installListener);
        listening = false;
        for (Map.Entry<PluginCall, Runnable> entry : pending.entrySet()) {
            handler.removeCallbacks(entry.getValue());
            entry.getKey().reject("업데이트 화면이 종료되었습니다.");
        }
        pending.clear();
    }
}
