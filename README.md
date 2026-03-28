# CiFi Optimization Suite

Static first-milestone implementation of the unified CiFi tool platform.

Important: the current optimizer math and sample data are still prototype placeholders. The suite structure is usable, but future calibration should be grounded in the CiFi wiki and the linked community tools before treating any recommendations as game-accurate.

## What is included

- Route-style pages for overview, player profile, data import, modules, validation, and research
- Shared player profile with guided calibration fields
- Local profile persistence and LR snapshots
- Versioned game-data snapshot in [`data/game-data.snapshot.v1.json`](/C:/Users/Shadow/Desktop/CiFi/data/game-data.snapshot.v1.json)
- Local sheet-data import workspace for CSV and JSON exports
- Generator manual-value OCR import scaffold on the `Data` page
- Ship loadout optimizer
- Progression priority recommender
- Gem-node optimizer
- Validation panel with parity-style benchmark checks
- Research panel for hunter simulation centralization, mech planning, and input automation

## Run locally

This app can still be opened directly in a browser, but it now also includes a tiny Node-based local server and smoke tests.

## Node commands

- `npm run dev`: starts a local static server on `http://localhost:4173`
- `npm test`: runs the smoke test suite against the current snapshot and app shell
- `launch-cifi.bat`: Windows launcher that starts the local dev server from the project folder

## Large numbers and OCR

- Numeric inputs now accept CiFi-style shorthand like `28.38k` as well as scientific notation like `2e5795`
- Generator fields in shared player state represent manual values for each `MK` tier
- The `Data` page includes a generator OCR scaffold so screenshots can be queued and parsed OCR JSON can be applied into `n1..n10`
- A future local OCR bridge can be attached to [`scripts/generator-ocr.py`](/C:/Users/Shadow/Desktop/CiFi/scripts/generator-ocr.py) once Tesseract is installed
- With Tesseract installed, you can now run [`scripts/generator-ocr.ps1`](/C:/Users/Shadow/Desktop/CiFi/scripts/generator-ocr.ps1) against generator screenshots and paste the resulting JSON into the `Data` page

Example:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\generator-ocr.ps1 C:\path\to\generators-1.png C:\path\to\generators-2.png
```

If `node` or `npm` are not yet on your PATH, reopen the terminal after install or call them from `C:\Program Files\nodejs`.

## Structure

- [`index.html`](/C:/Users/Shadow/Desktop/CiFi/index.html): app shell and module layout
- [`styles.css`](/C:/Users/Shadow/Desktop/CiFi/styles.css): visual system and responsive layout
- [`app.js`](/C:/Users/Shadow/Desktop/CiFi/app.js): state store, module logic, validation, persistence
- [`data/game-data.snapshot.v1.json`](/C:/Users/Shadow/Desktop/CiFi/data/game-data.snapshot.v1.json): imported snapshot placeholder for verified game data
- [`docs/ingest-process.md`](/C:/Users/Shadow/Desktop/CiFi/docs/ingest-process.md): lightweight import/versioning workflow
- [`docs/import-mapping.md`](/C:/Users/Shadow/Desktop/CiFi/docs/import-mapping.md): expected row shapes for CSV/JSON imports
- [`docs/cifi-wiki-reference.md`](/C:/Users/Shadow/Desktop/CiFi/docs/cifi-wiki-reference.md): local terminology and system reference from the wiki
- [`docs/spec-reevaluation.md`](/C:/Users/Shadow/Desktop/CiFi/docs/spec-reevaluation.md): what the current prototype gets wrong and how to recalibrate it
- [`docs/research-tracks.md`](/C:/Users/Shadow/Desktop/CiFi/docs/research-tracks.md): phase-1 research guidance
