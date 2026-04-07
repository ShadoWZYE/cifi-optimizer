# OCR Tooling (Optional)

OCR is optional local tooling for assisted player import. It is not core MVP behavior and it must not block core local-first usage.

## What it does

The dev server exposes `/api/generator-ocr`, which shells out to:

1. `scripts/ocr/generator-ocr.ps1`
2. `scripts/ocr/generator-ocr.py`
3. local Tesseract + Python OCR packages

If this stack is not installed, the app should still be usable through manual or guided input.

## Prerequisites

- PowerShell available on the local machine
- Python available on `PATH`
- Python packages used by `scripts/ocr/generator-ocr.py`
  - `opencv-python`
  - `pytesseract`
  - `numpy`
- Tesseract OCR installed locally

Current repo OCR tooling is Windows-oriented. The Python script currently points at the default Windows Tesseract install location under `Program Files`, so adjust that script or local install path if your machine differs.

## Setup expectation

Install Python and Tesseract first, then install the Python packages into the environment that PowerShell will use when it runs `python`.

Example package install:

```powershell
python -m pip install opencv-python pytesseract numpy
```

## Troubleshooting

If `/api/generator-ocr` fails, the error JSON now reports a failing stage:

- `powershell`: the wrapper script could not be found or launched
- `python`: Python or a required package such as `cv2`, `pytesseract`, or `numpy` failed
- `tesseract`: the OCR executable is missing or the configured path is wrong

Common fixes:

- install Python and confirm `python` works from PowerShell
- install missing Python packages for the active Python environment
- install Tesseract and confirm the configured executable path is valid
- verify the repo still contains `scripts/ocr/generator-ocr.ps1`

## MVP boundary

OCR remains optional tooling. Do not treat OCR availability as a requirement for canonical `state.playerProfile` import, planning, or recommendation behavior.
