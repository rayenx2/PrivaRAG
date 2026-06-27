# Branding Configuration

PrivaRAG ships with a dark purple theme. All visual constants are defined at the top of `frontend/src/App.jsx` in the `BRANDING` object.

## Changing the App Name or Colors

Edit the `BRANDING` constant in `frontend/src/App.jsx`:

```javascript
const BRANDING = {
  appName: 'PrivaRAG',
  primaryColor: '#7c3aed',   // purple-600
  accentColor: '#a855f7',    // purple-500
  version: 'v1.2',
}
```

After editing, rebuild the frontend:

```bash
cd rag-enterprise-structure
docker compose build --no-cache frontend
docker compose up -d frontend
```

## Banner

The repository banner is `assets/banner.svg` — a 1280×320 SVG with the PrivaRAG lock icon, tagline, and tech pill badges. Edit it directly with any SVG editor or text editor.

## Favicon

Place a `favicon.ico` in `frontend/public/` and rebuild the frontend. The current favicon is the default Vite icon.
