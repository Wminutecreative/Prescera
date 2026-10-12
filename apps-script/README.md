# Request-access form → Google Sheet + email

The website form posts to a Google Apps Script web app. The script adds a row to a Google Sheet and emails the team. It needs no server and no paid service.

## Setup (about 5 minutes)

1. **Create the Sheet.** In the Google account that should own the data (for example a presceralabs.ai Workspace account), create a new Google Sheet, for example "Prescera · Access requests".
2. **Add the script.** In the Sheet, open **Extensions → Apps Script**. Delete the sample code and paste in everything from `Code.gs`.
   - Change `NOTIFY_TO` if requests should go to someone other than vamsi@presceralabs.ai.
   - Set `SEND_CONFIRMATION = true` if the requester should also get a short receipt.
3. **Grant permissions.** In the editor, choose `testSubmit` in the function menu and click **Run**. Approve the Sheets and Gmail permissions. You should see a test row in the "Requests" tab and receive one email. Delete the test row afterwards.
4. **Deploy.** Click **Deploy → New deployment → Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy** and copy the **Web app URL** (it ends in `/exec`).
5. **Connect the site.** In the project root, copy `.env.example` to `.env` and set:
   ```
   PUBLIC_FORM_ENDPOINT=https://script.google.com/macros/s/XXXX/exec
   ```
   Set the same variable in your host's environment settings (Vercel, Netlify or Cloudflare Pages), then rebuild.

Opening the `/exec` URL in a browser should show `{"ok":true,"service":"prescera-request-access"}`.

## Updating the script later

Edit `Code.gs`, then **Deploy → Manage deployments → (pencil) → Version: New version → Deploy**. The URL stays the same. If you create a *new* deployment instead, the URL changes and the site's env var must be updated.

## Notes

- **Spam:** the form has a hidden spam-trap field. Anything that fills it is dropped without a row or an email. If spam still gets through, add Cloudflare Turnstile or reCAPTCHA.
- **Limits:** a consumer Gmail account can send about 100 script emails a day; a Workspace account about 1,500. That is far above the expected volume.
- **Data:** the Sheet holds names and work emails, so share it only with people who handle requests.
- **Without an endpoint:** if `PUBLIC_FORM_ENDPOINT` is empty, the form opens a pre-filled email to `PUBLIC_FORM_FALLBACK_EMAIL`, as the HTML prototype did.
