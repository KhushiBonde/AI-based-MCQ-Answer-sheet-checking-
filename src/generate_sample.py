"""
generate_sample.py
==================
Run this script once to generate:
  - dataset/sample_sheet.jpg   : a synthetic MCQ answer sheet image
  - dataset/answer_key.json    : the correct answer key

Usage:
    python src/generate_sample.py
"""

import json
import os
import sys
import random

sys.path.insert(0, os.path.dirname(__file__))
from utils import create_sample_answer_sheet

NUM_QUESTIONS        = 20
CHOICES_PER_QUESTION = 4
random.seed(99)

# ── Generate student marked answers ──────────────────────────────────
student_marks = [random.randint(0, CHOICES_PER_QUESTION - 1)
                 for _ in range(NUM_QUESTIONS)]

# ── Generate answer key (some match, some don't) ─────────────────────
correct_answers = []
for i, mark in enumerate(student_marks):
    if random.random() > 0.25:          # 75% chance student is correct
        correct_answers.append(mark)
    else:
        wrong = (mark + random.randint(1, CHOICES_PER_QUESTION - 1)) % CHOICES_PER_QUESTION
        correct_answers.append(wrong)

# ── Save sample sheet image ───────────────────────────────────────────
os.makedirs("dataset", exist_ok=True)
create_sample_answer_sheet(
    output_path   = "dataset/sample_sheet.jpg",
    num_questions = NUM_QUESTIONS,
    choices       = CHOICES_PER_QUESTION,
    marked_answers= student_marks,
)

# ── Save answer key JSON ──────────────────────────────────────────────
answer_key = {
    "num_questions"         : NUM_QUESTIONS,
    "choices_per_question"  : CHOICES_PER_QUESTION,
    "answers"               : correct_answers,   # 0-indexed (0=A, 1=B, 2=C, 3=D)
}

with open("dataset/answer_key.json", "w") as f:
    json.dump(answer_key, f, indent=2)

print(f"[INFO] Answer key saved to: dataset/answer_key.json")

LABELS = ["A", "B", "C", "D"]
print("\nAnswer Key Preview:")
for i, (s, c) in enumerate(zip(student_marks, correct_answers)):
    status = "✓" if s == c else "✗"
    print(f"  Q{i+1:02d}: Student={LABELS[s]}  Correct={LABELS[c]}  {status}")

expected_score = sum(1 for s, c in zip(student_marks, correct_answers) if s == c)
print(f"\nExpected score: {expected_score}/{NUM_QUESTIONS} "
      f"({expected_score/NUM_QUESTIONS*100:.1f}%)")
print("\nRun the checker with:")
print("  python src/main.py --image dataset/sample_sheet.jpg "
      "--key dataset/answer_key.json --show")
