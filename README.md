# Reachout Tool (GitHub Pages)

Static MailBlast site for GitHub Pages deployment.

## Website source
- `docs/index.html`

## Deploy (GitHub Pages)
1. Push to `main`.
2. In repo settings, open `Pages`.
3. Set:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/docs`

Site URL:
- `https://sunny-0102.github.io/Reachout_Tool-main/`

## Local testing
Serve the site from a local web server instead of opening the HTML file directly.

Example:
```bash
python3 -m http.server 8001
```

Then open:
- `http://localhost:8001/docs/index.html`

## Google OAuth setup
In Google Cloud Console OAuth client:
1. Enable Gmail API.
2. Create a new OAuth client of type `Web application`.
3. Add authorized JavaScript origins:
   - `https://sunny-0102.github.io`
   - `http://localhost:8001`
4. Add authorized redirect URIs:
   - `https://sunny-0102.github.io/Reachout_Tool-main/`
   - `http://localhost:8001/index.html`
   - `http://localhost:8001`
5. In `Google Auth Platform` (or `OAuth consent screen` in older UI), set the app audience correctly:
   - If the app is `External` and still in `Testing`, add every Gmail address you want to sign in with under `Test users`.
   - If you want anyone to use it, move the app to `Production` and complete any Google verification required for the Gmail scope.
6. Copy the new Google OAuth Client ID into the app using `Manage Client IDs`.

### If you no longer have the old Google Cloud account
- The app no longer hardcodes the old Google OAuth client ID.
- Create a fresh OAuth client in your current Google account and paste that new client ID into the app.
- If an old client ID was stored in your browser, the app now clears that legacy ID automatically.

### If another Google account gets `Error 403: access_denied`
- This usually means the OAuth app is in `Testing` and that Gmail address is not listed as a test user.
- Open the Google Cloud project that owns your OAuth client ID.
- Go to `Google Auth Platform` -> `Audience`.
- Add the blocked Gmail address under `Test users`, then try again.
- If you need public access beyond your own test accounts, switch the app to `Production` and complete Google's verification flow for the Gmail scope.

## Microsoft OAuth setup
In Microsoft Entra App registrations:
1. Create or open your app registration.
2. Under `Authentication`, add `Single-page application` redirect URIs:
   - `https://sunny-0102.github.io/Reachout_Tool-main/`
   - `http://localhost:8001/docs/index.html`
3. Under `API permissions`, add delegated permissions:
   - `User.Read`
   - `Mail.Send`
4. If you use a school or work tenant, grant admin consent if required.

## Notes
- Microsoft sign-in does not work from `file://` URLs.
- For local Microsoft testing, use `http://localhost/...` or an `https://` URL.
- Open tracking is approximate because some mail clients block, proxy, or preload images.

## Gmail Open Tracking
This repo now includes optional Gmail open tracking in the app plus a lightweight Google Apps Script tracker endpoint.

### What it does
- Adds an optional tracking pixel to Gmail sends.
- Logs each tracked recipient to a tracker endpoint after send.
- Shows `pending` vs `opened` status in the app's send screen.

### Tracker endpoint file
- `tracker/google-apps-script/Code.gs`

### Google Apps Script setup
1. Go to [script.new](https://script.new/) and create a new Apps Script project.
2. Replace the default file contents with the code from `tracker/google-apps-script/Code.gs`.
3. Change `TRACKER_STATUS_KEY` at the top of the script to a private value only you know.
4. Deploy the script as a `Web app`.
5. Set execute access to `Anyone`.
6. Copy the deployed `Web app URL`.

### MailBlast app setup
1. Sign in with Google in the MailBlast app.
2. In `Preview & Review`, enable `Open tracking`.
3. Paste your Apps Script `Web app URL`.
4. Paste the same `TRACKER_STATUS_KEY` value into `Tracking Status Key`.
5. Send your Gmail campaign.
6. Use `Refresh Opens` in the send screen to pull the latest open data.
