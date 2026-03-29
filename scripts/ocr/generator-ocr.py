import json
import sys
import cv2
import pytesseract
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
import re
import numpy as np

def prepare_image(img):
    if img is None or img.size == 0:
        return None

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    gray = cv2.resize(gray, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    gray = cv2.bilateralFilter(gray, 9, 75, 75)

    _, thresh = cv2.threshold(gray, 140, 255, cv2.THRESH_BINARY)

    return thresh
    
def preprocess_and_scale(img):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Edge detection to estimate text size
    edges = cv2.Canny(gray, 50, 150)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    heights = []
    for c in contours:
        x, y, w, h = cv2.boundingRect(c)
        if 10 < h < 100:
            heights.append(h)

    avg_height = np.mean(heights) if heights else 20

    # Normalize text height
    target_height = 30
    scale = target_height / avg_height

    img = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    return img


def extract_rows(img):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (3,3), 0)
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    # Use horizontal dilation to merge text in the same row
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (40, 5))
    dilated = cv2.dilate(thresh, kernel, iterations=1)

    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    rows = []
    h_img, w_img = img.shape[:2]
    for c in contours:
        x, y, w, h = cv2.boundingRect(c)
        if w > w_img * 0.1 and h > 15:  # relative thresholds
            rows.append((x, y, w, h))
    
    rows = sorted(rows, key=lambda r: r[1])
    return rows


def ocr_row(img, row):
    x, y, w, h = row
    roi = img[y:y+h, x:x+w]

    roi_proc = prepare_image(roi)
    if roi_proc is None:
        return None

    text = pytesseract.image_to_string(
        roi_proc,
        config='--oem 3 --psm 6 -c tessedit_char_whitelist=0123456789.kKM'
    )
    return text.strip()


def extract_value(text):
    match = re.search(r'\d+(\.\d+)?\s?[kKmM]?', text)
    return match.group().replace(" ", "") if match else None


def process_image(path):
    img = cv2.imread(path)

    if img is None:
        return {}

    img = preprocess_and_scale(img)
    proc = prepare_image(img)

    data = pytesseract.image_to_data(
        proc,
        output_type=pytesseract.Output.DICT,
        config='--oem 3 --psm 6'
    )

    results = {}
    n = len(data['text'])

    for i in range(n - 1):
        text1 = data['text'][i].strip().lower()
        text2 = data['text'][i + 1].strip().lower()

        conf1 = int(data['conf'][i])
        conf2 = int(data['conf'][i + 1])

        if conf1 < 40:
            continue

        # detect "mk" + number split across tokens
        if text1 == "mk" and text2.isdigit():
            mk_index = text2

            x = data['left'][i]
            y = data['top'][i]
            h = data['height'][i]

            # search to the right
            h_img, w_img = img.shape[:2]

            x1 = max(0, x + 40)
            x2 = min(w_img, x + int(0.3 * w_img))

            y1 = max(0, y)
            y2 = min(h_img, y + h)

            # Ensure valid region
            if x2 <= x1 or y2 <= y1:
                continue

            roi = img[y1:y2, x1:x2]

            # Extra safety
            if roi is None or roi.size == 0:
                continue

            roi_proc = prepare_image(roi)

            if roi_proc is None:
                continue

            value_text = pytesseract.image_to_string(
                roi_proc,
                config='--psm 7 -c tessedit_char_whitelist=0123456789.kKM'
            )

            value = extract_value(value_text)

            if value:
                results[f"mk{mk_index}"] = value

    return results


def map_generators(values):
    # Assume vertical order = Mk1 → MkN
    result = {}

    for i, val in enumerate(values[:10]):  # limit just in case
        result[f"mk{i+1}"] = val

    return result


def main():
    image_paths = sys.argv[1:]

    if not image_paths:
        print(json.dumps({}))
        return

    result = process_image(image_paths[0])

    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()