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
2. Add authorized JavaScript origins:
   - `https://sunny-0102.github.io`
   - `http://localhost:8001`

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
