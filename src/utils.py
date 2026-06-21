"""
utils.py
========
Helper functions for:
  - Loading / saving images
  - Drawing result overlays (green = correct, red = wrong, grey = unattempted)
  - Generating a score banner on the result image
"""

import cv2
import numpy as np
import os


CHOICE_LABELS = ["A", "B", "C", "D", "E"]

COLOR_CORRECT     = (34,  197, 94)    # Green
COLOR_WRONG       = (239, 68,  68)    # Red
COLOR_UNATTEMPTED = (156, 163, 175)   # Gray
COLOR_WHITE       = (255, 255, 255)
COLOR_BLACK       = (0,   0,   0)
COLOR_DARK        = (30,  30,  30)


def load_image(path):
    """Load image from path. Raises FileNotFoundError if not found."""
    if not os.path.exists(path):
        raise FileNotFoundError(f"Image not found: {path}")
    img = cv2.imread(path)
    if img is None:
        raise ValueError(f"Could not decode image: {path}")
    return img


def save_result_image(image, path):
    """Save result image to path, creating directories as needed."""
    os.makedirs(os.path.dirname(path) if os.path.dirname(path) else ".", exist_ok=True)
    cv2.imwrite(path, image)


def draw_results(image, rows, student_answers, correct_answers,
                 num_questions, choices_per_question):
    """
    Overlay coloured circles on bubbles to show correct/wrong/unattempted,
    then add a score banner at the top of the image.

    Colour coding:
        Green  = student's answer and it's correct
        Red    = student's answer but it's wrong
        Gray   = unattempted (no bubble filled)
        Green outline only = the correct answer when student was wrong
    """
    result = image.copy()

    CHOICE_LABELS_LOCAL = ["A", "B", "C", "D", "E"]

    # Normalise correct answers to 0-indexed ints
    correct_indices = []
    for c in correct_answers:
        if isinstance(c, str):
            correct_indices.append(CHOICE_LABELS_LOCAL.index(c.upper()))
        else:
            correct_indices.append(int(c))

    for q_idx, (row, student_ans, correct_idx) in enumerate(
            zip(rows, student_answers, correct_indices)):

        if not row:
            continue

        for choice_idx, bubble in enumerate(row):
            x, y, w, h = cv2.boundingRect(bubble)
            cx = x + w // 2
            cy = y + h // 2
            radius = max(w, h) // 2 + 2

            if student_ans is None:
                # Unattempted — draw thin gray circle on correct answer
                if choice_idx == correct_idx:
                    cv2.circle(result, (cx, cy), radius, COLOR_UNATTEMPTED, 2)
            elif choice_idx == student_ans:
                if student_ans == correct_idx:
                    # Correct — fill green
                    cv2.circle(result, (cx, cy), radius, COLOR_CORRECT, -1)
                    cv2.circle(result, (cx, cy), radius, COLOR_CORRECT, 2)
                else:
                    # Wrong — fill red
                    cv2.circle(result, (cx, cy), radius, COLOR_WRONG, -1)
                    cv2.circle(result, (cx, cy), radius, COLOR_WRONG, 2)
            elif choice_idx == correct_idx and student_ans != correct_idx:
                # Show the correct answer with green outline
                cv2.circle(result, (cx, cy), radius, COLOR_CORRECT, 3)

    # Add score banner at top
    result = add_score_banner(result, student_answers, correct_indices, num_questions)
    return result


def add_score_banner(image, student_answers, correct_indices, num_questions):
    """
    Add a score summary banner at the top of the image.
    """
    banner_h = 80
    banner   = np.ones((banner_h, image.shape[1], 3), dtype="uint8") * 30  # dark bg

    correct     = sum(1 for s, c in zip(student_answers, correct_indices)
                      if s is not None and s == c)
    wrong       = sum(1 for s, c in zip(student_answers, correct_indices)
                      if s is not None and s != c)
    unattempted = sum(1 for s in student_answers if s is None)
    percentage  = (correct / num_questions * 100) if num_questions > 0 else 0.0

    grade_color = COLOR_CORRECT if percentage >= 60 else COLOR_WRONG

    # Score text
    cv2.putText(banner,
                f"Score: {correct}/{num_questions}  ({percentage:.1f}%)",
                (20, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, COLOR_WHITE, 2)

    # Stats
    stats_text = f"Correct: {correct}   Wrong: {wrong}   Unattempted: {unattempted}"
    cv2.putText(banner, stats_text,
                (20, 58), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (180, 180, 180), 1)

    # Grade badge on the right
    if percentage >= 90:   grade = "A+"
    elif percentage >= 80: grade = "A"
    elif percentage >= 70: grade = "B"
    elif percentage >= 60: grade = "C"
    elif percentage >= 50: grade = "D"
    else:                  grade = "F"

    cv2.putText(banner, grade,
                (image.shape[1] - 70, 55),
                cv2.FONT_HERSHEY_SIMPLEX, 1.6, grade_color, 3)

    return np.vstack([banner, image])


def create_sample_answer_sheet(output_path, num_questions=20, choices=4,
                               bubble_radius=15, marked_answers=None):
    """
    Generate a synthetic MCQ answer sheet image for testing.

    Args:
        output_path    : where to save the generated image
        num_questions  : number of question rows
        choices        : number of choices per question (A, B, C, D)
        bubble_radius  : pixel radius of each bubble circle
        marked_answers : list of 0-indexed ints (which bubble to fill per row)
                         If None, a default pattern is used.
    """
    padding    = 50
    h_spacing  = 60    # vertical gap between rows
    w_spacing  = 60    # horizontal gap between bubbles
    left_margin= 100

    width  = left_margin + choices * w_spacing + padding * 2
    height = padding + num_questions * h_spacing + padding

    img = np.ones((height, width, 3), dtype="uint8") * 255   # white bg

    # Header
    cv2.putText(img, "MCQ Answer Sheet", (padding, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)

    # Column headers (A, B, C, D)
    labels = ["A", "B", "C", "D", "E"]
    for j in range(choices):
        cx = left_margin + j * w_spacing
        cv2.putText(img, labels[j], (cx - 6, padding - 5),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (100, 100, 100), 1)

    if marked_answers is None:
        import random
        random.seed(42)
        marked_answers = [random.randint(0, choices - 1) for _ in range(num_questions)]

    for i in range(num_questions):
        cy = padding + i * h_spacing + h_spacing // 2

        # Question number
        cv2.putText(img, f"Q{i+1}", (10, cy + 5),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, (80, 80, 80), 1)

        for j in range(choices):
            cx = left_margin + j * w_spacing
            if j == marked_answers[i]:
                # Filled bubble
                cv2.circle(img, (cx, cy), bubble_radius, (0, 0, 0), -1)
            else:
                # Empty bubble outline
                cv2.circle(img, (cx, cy), bubble_radius, (0, 0, 0), 2)

    os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else ".", exist_ok=True)
    cv2.imwrite(output_path, img)
    print(f"[INFO] Sample answer sheet saved to: {output_path}")
    print(f"       Marked answers (0-indexed): {marked_answers}")
    return marked_answers
