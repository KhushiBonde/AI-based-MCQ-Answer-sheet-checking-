"""
detector.py
===========
Handles bubble (OMR circle) detection and identification of marked answers.

Pipeline:
    1. Threshold the warped image
    2. Find all circular contours (bubbles)
    3. Sort into rows (one row per question)
    4. For each row, find the bubble with the highest filled-pixel count → that's the marked answer
"""

import cv2
import numpy as np


def preprocess_for_bubbles(image):
    """
    Convert image to a clean binary (thresholded) image for contour detection.
    """
    gray    = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # Otsu's thresholding — automatically finds optimal threshold
    _, thresh = cv2.threshold(blurred, 0, 255,
                              cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    return thresh


def is_circle_like(contour, min_area=50, max_area=8000, aspect_ratio_tol=0.6):
    """
    Returns True if a contour looks like a filled bubble (roughly circular).
    """
    area = cv2.contourArea(contour)
    if area < min_area or area > max_area:
        return False

    x, y, w, h = cv2.boundingRect(contour)
    if h == 0:
        return False

    aspect_ratio = w / float(h)
    if abs(aspect_ratio - 1.0) > aspect_ratio_tol:
        return False

    # Circularity check: 4π·area / perimeter²  (1.0 = perfect circle)
    perimeter = cv2.arcLength(contour, True)
    if perimeter == 0:
        return False
    circularity = (4 * np.pi * area) / (perimeter ** 2)
    if circularity < 0.35:
        return False

    return True


def detect_bubbles(image, num_questions, choices_per_question, debug=False):
    """
    Detect all bubble contours in the image and organise them into rows.

    Returns:
        List of rows, where each row is a list of (contour, bounding_box) tuples.
        len(rows) == num_questions, len(rows[i]) == choices_per_question

    Returns None if detection fails.
    """
    thresh   = preprocess_for_bubbles(image)
    contours, _ = cv2.findContours(thresh.copy(), cv2.RETR_EXTERNAL,
                                   cv2.CHAIN_APPROX_SIMPLE)

    # Filter to keep only circular contours (bubbles)
    bubble_contours = [c for c in contours if is_circle_like(c)]

    # Exclude pixels in the top 5% of the image (header noise)
    height = image.shape[0]
    bubble_contours = [c for c in bubble_contours if cv2.boundingRect(c)[1] > 0.05 * height]

    if debug:
        dbg = image.copy()
        cv2.drawContours(dbg, bubble_contours, -1, (0, 255, 0), 2)
        cv2.imshow("All detected bubbles", dbg)

    total_expected = num_questions * choices_per_question

    if len(bubble_contours) < total_expected:
        print(f"[WARN] Expected {total_expected} bubbles, found {len(bubble_contours)}.")
        print("       Try improving image quality / lighting.")

    # Sort bubbles top-to-bottom, then left-to-right within each row
    bubble_contours = sorted(bubble_contours,
                             key=lambda c: cv2.boundingRect(c)[1])  # sort by y

    # Group into rows by proximity in y-coordinate
    rows  = []
    row   = []
    prev_y = None
    y_tolerance = image.shape[0] / (num_questions * 5.0)

    for c in bubble_contours:
        _, y, _, h = cv2.boundingRect(c)
        cy = y + h // 2   # center y of bubble

        if prev_y is None or abs(cy - prev_y) < y_tolerance:
            row.append(c)
        else:
            if row:
                # Sort this row left-to-right by x
                row_sorted = sorted(row, key=lambda c: cv2.boundingRect(c)[0])
                rows.append(row_sorted[:choices_per_question])
            row = [c]
        prev_y = cy

    # Don't forget the last row
    if row:
        row_sorted = sorted(row, key=lambda c: cv2.boundingRect(c)[0])
        rows.append(row_sorted[:choices_per_question])

    # Ensure we have exactly num_questions rows
    rows = rows[:num_questions]

    if len(rows) < num_questions:
        print(f"[WARN] Only {len(rows)} question rows detected (expected {num_questions}).")
        # Pad with empty rows to avoid index errors downstream
        while len(rows) < num_questions:
            rows.append([])

    return rows


def count_filled_pixels(thresh_image, contour):
    """
    Count non-zero (white) pixels inside the given contour on the thresholded image.
    A higher count = more filled = this bubble is marked.
    """
    mask = np.zeros(thresh_image.shape, dtype="uint8")
    cv2.drawContours(mask, [contour], -1, 255, -1)  # filled mask
    filled_pixels = cv2.countNonZero(cv2.bitwise_and(thresh_image, thresh_image, mask=mask))
    return filled_pixels


def find_answered_bubbles(image, rows, num_questions, choices_per_question):
    """
    For each question row, find the bubble with the most filled pixels.
    That bubble is the student's selected answer (0-indexed: 0=A, 1=B, 2=C, 3=D).

    Uses adaptive thresholding: a bubble is "marked" if it has significantly
    more filled pixels than the other (empty) bubbles in the same row.

    Returns:
        List of length num_questions.
        Each element is an int (0 to choices_per_question-1) or None (unattempted).
    """
    thresh = preprocess_for_bubbles(image)
    student_answers = []

    # ── Compute adaptive threshold ────────────────────────────────────────────
    # Gather all pixel counts across all rows to understand the image scale
    all_counts = []
    row_counts = []
    for row in rows:
        counts = []
        for bubble in row:
            count = count_filled_pixels(thresh, bubble)
            counts.append(count)
            all_counts.append(count)
        row_counts.append(counts)

    if not all_counts:
        return [None] * num_questions

    # The minimum absolute threshold adapts to actual bubble sizes in this image
    # Empty bubbles typically have very low counts; filled ones are 2-4x higher
    overall_median = float(np.median(all_counts))
    ADAPTIVE_FLOOR = max(50, overall_median * 0.3)  # absolute minimum to filter noise

    for q_idx, row in enumerate(rows):
        if not row or q_idx >= len(row_counts):
            student_answers.append(None)
            continue

        pixel_counts = row_counts[q_idx]
        if not pixel_counts:
            student_answers.append(None)
            continue

        max_count = max(pixel_counts)

        # Skip if maximum is below absolute floor (noise)
        if max_count < ADAPTIVE_FLOOR:
            student_answers.append(None)
            continue

        # Within a row, the marked bubble should be significantly darker than
        # the empty ones. Compute the ratio of max to the mean of the rest.
        if len(pixel_counts) > 1:
            sorted_counts = sorted(pixel_counts)
            # Mean of the lower counts (the "empty" bubbles)
            lower_mean = np.mean(sorted_counts[:-1]) if len(sorted_counts) > 1 else 0
            # The marked bubble must have at least 1.5x the fill of the empties
            if lower_mean > 0 and max_count < lower_mean * 1.5:
                student_answers.append(None)  # No clear winner
                continue

        student_answers.append(int(np.argmax(pixel_counts)))

    return student_answers

