"""
AI Based MCQ Answer Sheet Checking Algorithm
============================================
Main entry point - run this file to check an answer sheet.

Usage:
    python src/main.py --image dataset/sample_sheet.jpg --key dataset/answer_key.json
    python src/main.py --image dataset/sample_sheet.jpg --key dataset/answer_key.json --show
"""

import argparse
import json
import os
import sys
import cv2
from scanner import scan_and_warp
from detector import detect_bubbles, find_answered_bubbles
from checker import check_answers, generate_report
from utils import load_image, save_result_image, draw_results


def parse_args():
    parser = argparse.ArgumentParser(description="AI Based MCQ Answer Sheet Checker")
    parser.add_argument("--image", type=str, required=True, help="Path to MCQ sheet image")
    parser.add_argument("--key",   type=str, required=True, help="Path to answer key JSON file")
    parser.add_argument("--show",  action="store_true",     help="Display result image")
    parser.add_argument("--out",   type=str, default="output/result.jpg", help="Output image path")
    return parser.parse_args()


def main():
    args = parse_args()

    # ── 1. Validate inputs ───────────────────────────────────────────
    if not os.path.exists(args.image):
        print(f"[ERROR] Image not found: {args.image}")
        sys.exit(1)
    if not os.path.exists(args.key):
        print(f"[ERROR] Answer key not found: {args.key}")
        sys.exit(1)

    print("\n" + "="*50)
    print("  AI MCQ Answer Sheet Checker")
    print("="*50)

    # ── 2. Load image ────────────────────────────────────────────────
    print(f"\n[1/6] Loading image: {args.image}")
    image = load_image(args.image)
    print(f"      Image size: {image.shape[1]}x{image.shape[0]} px")

    # ── 3. Load answer key ───────────────────────────────────────────
    print(f"[2/6] Loading answer key: {args.key}")
    with open(args.key, "r") as f:
        answer_key = json.load(f)
    num_questions = len(answer_key["answers"])
    num_choices   = answer_key.get("choices_per_question", 4)
    print(f"      Questions: {num_questions}  |  Choices each: {num_choices}")

    # ── 4. Scan & warp perspective ───────────────────────────────────
    print("[3/6] Scanning and correcting perspective...")
    warped = scan_and_warp(image)
    if warped is None:
        print("      [WARN] Could not find sheet boundary — using original image.")
        warped = image.copy()
    else:
        print("      Perspective correction applied.")

    # ── 5. Detect bubbles ────────────────────────────────────────────
    print("[4/6] Detecting answer bubbles...")
    bubbles = detect_bubbles(warped, num_questions, num_choices)
    if bubbles is None:
        print("[ERROR] Could not detect bubbles. Check image quality.")
        sys.exit(1)
    print(f"      Detected {len(bubbles)} bubble groups ({num_questions} questions × {num_choices} choices).")

    # ── 6. Find marked answers ───────────────────────────────────────
    print("[5/6] Identifying marked answers...")
    student_answers = find_answered_bubbles(warped, bubbles, num_questions, num_choices)
    print(f"      Answered: {sum(1 for a in student_answers if a is not None)}/{num_questions} questions")

    # ── 7. Check answers & generate report ───────────────────────────
    print("[6/6] Checking answers and generating report...")
    results = check_answers(student_answers, answer_key["answers"])
    report  = generate_report(results, num_questions)

    # ── 8. Print report ──────────────────────────────────────────────
    print("\n" + "="*50)
    print("  RESULT REPORT")
    print("="*50)
    print(f"  Total Questions : {report['total']}")
    print(f"  Correct         : {report['correct']}  ✓")
    print(f"  Wrong           : {report['wrong']}   ✗")
    print(f"  Unattempted     : {report['unattempted']}")
    print(f"  Score           : {report['score']:.1f} / {report['total']}")
    print(f"  Percentage      : {report['percentage']:.1f}%")
    print(f"  Grade           : {report['grade']}")
    print("="*50)

    # ── 9. Save result image ─────────────────────────────────────────
    result_img = draw_results(warped, bubbles, student_answers, answer_key["answers"],
                              num_questions, num_choices)
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    save_result_image(result_img, args.out)
    print(f"\n  Result image saved → {args.out}")

    if args.show:
        cv2.imshow("MCQ Result", result_img)
        print("  Press any key to close the window...")
        cv2.waitKey(0)
        cv2.destroyAllWindows()

    print("\n  Done!\n")
    return report


if __name__ == "__main__":
    main()
