package com.leean0121.careroute;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import com.google.android.gms.auth.api.identity.GetSignInIntentRequest;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.auth.api.identity.SignInCredential;

/** Internal ID-token login, separate from Calendar authorization. Tokens are never logged. */
public class GoogleSignInActivity extends Activity {
    private static final int SIGN_IN = 732;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        if (state != null) return;
        String clientId = getIntent().getStringExtra("clientId");
        String nonce = getIntent().getStringExtra("nonce");
        if (clientId == null || clientId.isEmpty() || nonce == null || !nonce.matches("[0-9a-f]{64}")) {
            fail("Google 로그인 설정이 올바르지 않습니다."); return;
        }
        GetSignInIntentRequest request = GetSignInIntentRequest.builder()
            .setServerClientId(clientId)
            .setNonce(nonce)
            .build();
        Identity.getSignInClient(this).getSignInIntent(request)
            .addOnSuccessListener(result -> {
                try { startIntentSenderForResult(result.getIntentSender(), SIGN_IN, null, 0, 0, 0); }
                catch (Exception error) { fail("Google 로그인 화면을 열지 못했습니다."); }
            })
            .addOnFailureListener(error -> fail("Google 로그인을 시작하지 못했습니다. Play 서비스와 계정 설정을 확인해주세요."));
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request != SIGN_IN) return;
        if (result != RESULT_OK || data == null) { fail("Google 로그인이 취소되었습니다."); return; }
        try {
            SignInCredential credential = Identity.getSignInClient(this).getSignInCredentialFromIntent(data);
            String token = credential.getGoogleIdToken();
            if (token == null || token.isEmpty()) { fail("Google ID 토큰을 받지 못했습니다."); return; }
            setResult(RESULT_OK, new Intent().putExtra("idToken", token));
            finish();
        } catch (Exception error) { fail("Google 계정을 확인하지 못했습니다. 다시 로그인해주세요."); }
    }

    private void fail(String message) {
        setResult(RESULT_CANCELED, new Intent().putExtra("error", message));
        finish();
    }
}
