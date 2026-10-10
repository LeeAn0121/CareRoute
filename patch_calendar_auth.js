const fs = require('fs');
let code = fs.readFileSync('src/app/page.tsx', 'utf-8');

const oldAuth = `      const accessToken: string = await new Promise((resolve, reject) => {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/calendar.events',
          callback: (resp: any) => {
            if (resp.error) reject(new Error(resp.error));
            else resolve(resp.access_token);
          },
        });
        tokenClient.requestAccessToken();
      });`;

const newAuth = `      let accessToken = localStorage.getItem('google_access_token');
      const expiresAt = localStorage.getItem('google_access_token_expires');

      if (!accessToken || !expiresAt || Date.now() > parseInt(expiresAt)) {
        accessToken = await new Promise<string>((resolve, reject) => {
          const tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: 'https://www.googleapis.com/auth/calendar.events',
            callback: (resp: any) => {
              if (resp.error) reject(new Error(resp.error));
              else {
                localStorage.setItem('google_access_token', resp.access_token);
                // expires_in is usually 3599 seconds. We subtract 60s for safety buffer.
                localStorage.setItem('google_access_token_expires', (Date.now() + (resp.expires_in - 60) * 1000).toString());
                resolve(resp.access_token);
              }
            },
          });
          // prompt: '' skips the consent screen if already authorized previously
          tokenClient.requestAccessToken({ prompt: '' });
        });
      }`;

code = code.replace(oldAuth, newAuth);
fs.writeFileSync('src/app/page.tsx', code);
console.log("Patched Google Auth Cache");
