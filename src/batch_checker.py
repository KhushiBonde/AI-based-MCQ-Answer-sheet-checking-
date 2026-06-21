"""
batch_checker.py
================
Check multiple answer sheet images at once from a folder.

Usage:
    python src/batch_checker.py --folder dataset/sheets/ --key dataset/answer_key.json
    python src/batch_checker.py --folder dataset/sheets/ --key dataset/answer_key.json --csv output/results.csv
"""

import argparse
import json
import os
import sys
import csv
import cv2

sys.path.insert(0, os.path.dirname(__file__))
from scanner import scan_and_warp
from detector import detect_bubbles, find_answered_bubbles
from checker import check_answers, generate_report
from utils import load_image, save_result_image, draw_results

SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".tiff"}


def process_single_sheet(image_path, answer_key, out_dir):
    """Process one sheet and return its report dict."""
    image = load_image(image_path)

    num_q   = len(answer_key["answers"])
    num_c   = answer_key.get("choices_per_question", 4)

    warped  = scan_and_warp(image) or image.copy()
    rows    = detect_bubbles(warped, num_q, num_c)
    if rows is None:
        return None

    student_answers = find_answered_bubbles(warped, rows, num_q, num_c)
    results         = check_answers(student_answers, answer_key["answers"])
    report          = generate_report(results, num_q)

    # Save annotated result image
    result_img  = draw_results(warped, rows, student_answers,
                               answer_key["answers"], num_q, num_c)
    stem        = os.path.splitext(os.path.basename(image_path))[0]
    out_path    = os.path.join(out_dir, f"{stem}_result.jpg")
    save_result_image(result_img, out_path)

    return report


def main():
    parser = argparse.ArgumentParser(description="Batch MCQ Answer Sheet Checker")
    parser.add_argument("--folder", required=True, help="Folder containing sheet images")
    parser.add_argument("--key",    required=True, help="Answer key JSON file")
    parser.add_argument("--out",    default="output/batch_results", help="Output folder for result images")
    parser.add_argument("--csv",    default=None,  help="Optional CSV file to save all scores")
    args = parser.parse_args()

    # Load answer key
    with open(args.key) as f:
        answer_key = json.load(f)

    os.makedirs(args.out, exist_ok=True)

    # Collect image paths
    image_paths = [
        os.path.join(args.folder, fn)
        for fn in sorted(os.listdir(args.folder))
        if os.path.splitext(fn)[1].lower() in SUPPORTED_EXTENSIONS
    ]

    if not image_paths:
        print(f"[ERROR] No images found in: {args.folder}")
        sys.exit(1)

    print(f"\nFound {len(image_paths)} sheet(s) to process.\n")
    print(f"{'File':<30} {'Score':>8} {'%':>8} {'Grade':>6}")
    print("-" * 56)

    all_reports = []
    for path in image_paths:
        fname  = os.path.basename(path)
        report = process_single_sheet(path, answer_key, args.out)

        if report is None:
            print(f"{fname:<30} {'ERROR':>8} {'—':>8} {'—':>6}")
            continue

        print(f"{fname:<30} {report['score']:>5.0f}/{report['total']:<2} "
              f"{report['percentage']:>7.1f}% {report['grade']:>6}")

        all_reports.append({"file": fname, **report})

    # Summary
    if all_reports:
        avg = sum(r["percentage"] for r in all_reports) / len(all_reports)
        print("-" * 56)
        print(f"{'Average':<30} {'':>8} {avg:>7.1f}%")
        print(f"\nResult images saved to: {args.out}/")

    # Optional CSV export
    if args.csv and all_reports:
        with open(args.csv, "w", newline="") as csvfile:
            fieldnames = ["file", "total", "correct", "wrong", "unattempted",
                          "score", "percentage", "grade"]
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            for r in all_reports:
                writer.writerow({k: r[k] for k in fieldnames if k in r})
        print(f"CSV results saved to: {args.csv}")


if __name__ == "__main__":
    main()
