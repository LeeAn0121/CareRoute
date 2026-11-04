package com.leean0121.careroute;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.common.api.Scope;
import java.util.Collections;

/** Internal activity: Google Play services owns the account/consent UI. */
public class CalendarAuthorizationActivity extends Activity {
    private static final int CONSENT = 731;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        if (state != null) return;
        AuthorizationRequest request = AuthorizationRequest.builder()
            .setRequestedScopes(Collections.singletonList(new Scope("https://www.googleapis.com/auth/calendar.events")))
            .build();
        Identity.getAuthorizationClient(this).authorize(request)
            .addOnSuccessListener(result -> {
                if (result.hasResolution()) {
                    try { startIntentSenderForResult(result.getPendingIntent().getIntentSender(), CONSENT, null, 0, 0, 0); }
                    catch (Exception error) { fail("Google 계정 동의 화면을 열지 못했습니다."); }
                } else complete(result);
            })
            .addOnFailureListener(error -> fail("Google 캘린더 인증 실패: " + error.getMessage()));
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request != CONSENT) return;
        if (result != RESULT_OK || data == null) { fail("Google 캘린더 연결이 취소되었습니다."); return; }
        try { complete(Identity.getAuthorizationClient(this).getAuthorizationResultFromIntent(data)); }
        catch (Exception error) { fail("Google 캘린더 권한을 확인하지 못했습니다."); }
    }

    private void complete(AuthorizationResult result) {
        String token = result.getAccessToken();
        if (token == null || token.isEmpty()) { fail("Google 캘린더 접근 권한이 필요합니다."); return; }
        setResult(RESULT_OK, new Intent().putExtra("accessToken", token));
        finish();
    }

    private void fail(String message) {
        setResult(RESULT_CANCELED, new Intent().putExtra("error", message));
        finish();
    }
}
