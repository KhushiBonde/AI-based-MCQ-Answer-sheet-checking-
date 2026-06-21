# Dataset Info

## Quick Start — Generate a Sample Sheet
Run this once to create a test image and answer key:

```bash
python src/generate_sample.py
```

This creates:
- `dataset/sample_sheet.jpg`  — synthetic MCQ sheet with 20 questions
- `dataset/answer_key.json`   — matching answer key

Then run the checker:
```bash
python src/main.py --image dataset/sample_sheet.jpg --key dataset/answer_key.json --show
```

## Using Your Own Sheet
1. Photograph or scan your MCQ answer sheet (clear, well-lit)
2. Save it to `dataset/your_sheet.jpg`
3. Edit `dataset/answer_key.json` with correct answers (0=A, 1=B, 2=C, 3=D)
4. Run: `python src/main.py --image dataset/your_sheet.jpg --key dataset/answer_key.json`

## Answer Key Format
```json
{
  "num_questions": 20,
  "choices_per_question": 4,
  "answers": [0, 2, 1, 3, ...]
}
```
