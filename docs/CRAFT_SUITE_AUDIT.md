# Craft App Suite Integration Audit

## Source
- Organization: https://github.com/storytold
- Licence: MIT OR Apache-2.0 for all Craft apps
- Runtime: WebAssembly static builds bundled locally (no backend required)

## Applications
All 15 requested apps are bundled under `apps/<id>/` using official web builds:
PhotoCraft, VectorCraft, FilmCraft, LightCraft, PdfCraft, EffectCraft, DesignCraft, FigCraft, WordCraft, SoundCraft, DeckCraft, CADCraft, GridCraft, TextureCraft, Craft Anything.

## Integration
- Registered in `js/app-list.js` appCatalog.
- Each has a launcher icon and opens in the existing window manager via iframe.
- No dependency on app.getartcraft.com or ArtCraft backend/API.
- Offline-capable static assets.

## Limitations
- Large WebAssembly bundles; performance depends on browser.
- FilmCraft web build may be limited compared to desktop.
- No persistent IndexedDB project storage implemented yet for these apps (they manage their own storage).
- Third-party attribution files (LICENSE/NOTICE/ATTRIBUTION) are preserved in each app folder.