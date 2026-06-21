"""
checker.py
==========
Compares student answers against the answer key and
generates a detailed score report.
"""


CHOICE_LABELS = ["A", "B", "C", "D", "E"]


def check_answers(student_answers, correct_answers):
    """
    Compare student answers with correct answers.

    Args:
        student_answers : list of int or None  (0-indexed per question)
        correct_answers : list of int or str   (0-indexed int OR "A"/"B"/"C"/"D")

    Returns:
        List of dicts, one per question:
            {
                "question"       : int   (1-based)
                "student_answer" : str   ("A", "B", ... or "—")
                "correct_answer" : str   ("A", "B", ...)
                "status"         : str   ("correct", "wrong", "unattempted")
            }
    """
    results = []

    for i, (student, correct) in enumerate(zip(student_answers, correct_answers)):

        # Normalise correct answer to 0-indexed int
        if isinstance(correct, str):
            correct_idx = CHOICE_LABELS.index(correct.upper())
        else:
            correct_idx = int(correct)

        correct_label = CHOICE_LABELS[correct_idx]

        if student is None:
            status         = "unattempted"
            student_label  = "—"
        elif student == correct_idx:
            status         = "correct"
            student_label  = CHOICE_LABELS[student]
        else:
            status         = "wrong"
            student_label  = CHOICE_LABELS[student]

        results.append({
            "question"       : i + 1,
            "student_answer" : student_label,
            "correct_answer" : correct_label,
            "status"         : status,
        })

    return results


def generate_report(results, num_questions):
    """
    Summarise results into an overall report dict.

    Returns:
        {
            "total"       : int,
            "correct"     : int,
            "wrong"       : int,
            "unattempted" : int,
            "score"       : float,
            "percentage"  : float,
            "grade"       : str,
            "details"     : list of per-question dicts
        }
    """
    correct     = sum(1 for r in results if r["status"] == "correct")
    wrong       = sum(1 for r in results if r["status"] == "wrong")
    unattempted = sum(1 for r in results if r["status"] == "unattempted")
    score       = float(correct)
    percentage  = (score / num_questions * 100) if num_questions > 0 else 0.0

    if percentage >= 90:
        grade = "A+"
    elif percentage >= 80:
        grade = "A"
    elif percentage >= 70:
        grade = "B"
    elif percentage >= 60:
        grade = "C"
    elif percentage >= 50:
        grade = "D"
    else:
        grade = "F"

    return {
        "total"       : num_questions,
        "correct"     : correct,
        "wrong"       : wrong,
        "unattempted" : unattempted,
        "score"       : score,
        "percentage"  : percentage,
        "grade"       : grade,
        "details"     : results,
    }


def print_detailed_report(report):
    """
    Pretty-print a per-question breakdown to the console.
    """
    print("\n" + "-"*52)
    print(f"  {'Q#':<5} {'Student':^10} {'Correct':^10} {'Status'}")
    print("-"*52)

    status_icons = {
        "correct"     : "✓",
        "wrong"       : "✗",
        "unattempted" : "○",
    }

    for r in report["details"]:
        icon = status_icons[r["status"]]
        print(f"  Q{r['question']:<4} {r['student_answer']:^10} {r['correct_answer']:^10} {icon} {r['status'].capitalize()}")

    print("-"*52)
    print(f"  Score: {report['score']:.0f}/{report['total']}  "
          f"({report['percentage']:.1f}%)  Grade: {report['grade']}")
    print("-"*52 + "\n")
