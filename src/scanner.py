"""
scanner.py
==========
Handles image scanning and perspective (warp) correction.
Finds the largest 4-cornered contour (the answer sheet) and
applies a bird's-eye-view perspective transform.
"""

import cv2
import numpy as np


def order_points(pts):
    """
    Order 4 corner points as: top-left, top-right, bottom-right, bottom-left.
    """
    rect = np.zeros((4, 2), dtype="float32")
    s    = pts.sum(axis=1)
    diff = np.diff(pts, axis=1)

    rect[0] = pts[np.argmin(s)]     # top-left     (smallest x+y)
    rect[2] = pts[np.argmax(s)]     # bottom-right (largest  x+y)
    rect[1] = pts[np.argmin(diff)]  # top-right    (smallest x-y)
    rect[3] = pts[np.argmax(diff)]  # bottom-left  (largest  x-y)
    return rect


def four_point_transform(image, pts):
    """
    Apply perspective transform to get a top-down view of the sheet.
    """
    rect = order_points(pts)
    (tl, tr, br, bl) = rect

    # Compute output width and height
    widthA  = np.linalg.norm(br - bl)
    widthB  = np.linalg.norm(tr - tl)
    maxW    = max(int(widthA), int(widthB))

    heightA = np.linalg.norm(tr - br)
    heightB = np.linalg.norm(tl - bl)
    maxH    = max(int(heightA), int(heightB))

    dst = np.array([
        [0,        0       ],
        [maxW - 1, 0       ],
        [maxW - 1, maxH - 1],
        [0,        maxH - 1]
    ], dtype="float32")

    M       = cv2.getPerspectiveTransform(rect, dst)
    warped  = cv2.warpPerspective(image, M, (maxW, maxH))
    return warped


def scan_and_warp(image, debug=False):
    """
    Find the answer sheet in the image and return a warped (top-down) version.

    Steps:
        1. Resize for consistent processing
        2. Grayscale + Gaussian blur
        3. Canny edge detection
        4. Find contours → pick largest 4-sided contour
        5. Apply perspective transform

    Returns:
        warped image (ndarray) or None if sheet boundary not found.
    """
    orig   = image.copy()
    ratio  = image.shape[0] / 500.0
    resized = cv2.resize(image, (int(image.shape[1] / ratio), 500))

    # Step 1: Grayscale + blur
    gray    = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # Step 2: Edge detection
    edged   = cv2.Canny(blurred, 75, 200)

    if debug:
        cv2.imshow("Edges", edged)

    # Step 3: Find contours
    contours, _ = cv2.findContours(edged.copy(), cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    contours     = sorted(contours, key=cv2.contourArea, reverse=True)[:5]

    sheet_contour = None
    for c in contours:
        peri   = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.02 * peri, True)

        if len(approx) == 4:           # Found a 4-cornered shape
            sheet_contour = approx
            break

    if sheet_contour is None:
        # Fallback: No boundary found. Maybe the image IS the sheet?
        # (Common for high-quality scans or digital uploads)
        return image

    # Scale back to original image coordinates
    sheet_contour = sheet_contour.reshape(4, 2) * ratio

    # Step 4: Apply perspective transform
    warped = four_point_transform(orig, sheet_contour)
    return warped
