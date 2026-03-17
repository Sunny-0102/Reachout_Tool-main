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
- `https://sahilsvachhani.github.io/Reachout_Tool/`

## Google OAuth setup
In Google Cloud Console OAuth client:
1. Enable Gmail API.
2. Add authorized JavaScript origins:
   - `https://sahilsvachhani.github.io`
   - `http://localhost:5001` (optional local testing)
