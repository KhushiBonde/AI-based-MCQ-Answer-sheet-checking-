import os
import sys
import json
import time
from pathlib import Path
from rich.console import Console
from rich.table import Table

# Add root and src dir to system path so we can import app and src modules directly
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'src'))

from app.core.omr_engine import run_omr_check
import cv2

console = Console()

def run_accuracy_test(dataset_dir: str, answer_key_path: str):
    console.print(f"[bold blue]Starting Markix OMR Accuracy Benchmark[/bold blue]")
    console.print(f"Dataset path: {dataset_dir}")
    
    if not os.path.exists(dataset_dir):
        console.print("[bold red]Dataset directory not found.[/bold red]")
        sys.exit(1)
        
    if not os.path.exists(answer_key_path):
        console.print("[bold red]Answer key JSON not found.[/bold red]")
        sys.exit(1)
        
    with open(answer_key_path, 'r') as f:
        known_key = json.load(f)
        
    answers_list = known_key.get("answers", [])
    
    # Datasets might be [3, 1, 0] or list of dicts. We have to parse them to {"1": "D", "2": "B"} representations
    correct_answers = {}
    letters = ['A', 'B', 'C', 'D', 'E']
    
    if isinstance(answers_list, list):
        if len(answers_list) > 0 and isinstance(answers_list[0], int):
            for idx, val in enumerate(answers_list):
                correct_answers[str(idx + 1)] = letters[val] if 0 <= val < len(letters) else ""
        else:
            correct_answers = {str(item["id"]): item["answer"] for item in answers_list if "id" in item and "answer" in item}
    else:
        correct_answers = {str(k): v for k,v in answers_list.items() if v is not None}
    total_questions = len(correct_answers)
    
    stats = {
        'total_images': 0,
        'successful_reads': 0,
        'failed_reads': 0,
        'total_question_comparisons': 0,
        'correct_comparisons': 0,
        'total_time_ms': 0
    }
    
    table = Table(title="Benchmark Results per Image")
    table.add_column("Filename", style="cyan")
    table.add_column("Status", style="magenta")
    table.add_column("Accuracy", justify="right", style="green")
    table.add_column("Time (ms)", justify="right")
    
    image_paths = list(Path(dataset_dir).glob("*.jpg")) + list(Path(dataset_dir).glob("*.png"))
    
    if not image_paths:
        console.print("[yellow]No images found in dataset directory.[/yellow]")
        return
        
    for img_path in image_paths:
        stats['total_images'] += 1
        start_time = time.time()
        
        try:
            # We call run_omr_check with just the image path to simulate the full pipeline
            # without requiring FastAPI UploadFile bytes injection
            with open(str(img_path), "rb") as f:
                img_bytes = f.read()
                
            result = run_omr_check(
                image_bytes=img_bytes,
                answers=known_key.get("answers", []),
                choices_per_question=known_key.get("choices_per_question", 4),
                question_count=known_key.get("num_questions", total_questions)
            )
            
            elapsed_ms = int((time.time() - start_time) * 1000)
            stats['total_time_ms'] += elapsed_ms
            
            if "error" not in result:
                stats['successful_reads'] += 1
                
                # We need to compute accuracy using `result['per_question']` instead of raw `answers` if it doesn't exist
                # But since the script manually compares with true dictionary expected values, we can get student_answers dynamically from result
                detected_answers = {str(q['q']): q['student_answer'] for q in result.get("per_question", [])}
                
                # Check accuracy against the PERFECT expected answers
                correct_for_sheet = 0
                for q_num, expected in correct_answers.items():
                    # The OMR engine returns student_answer as 0-indexed int or None
                    student_ans_idx = detected_answers.get(q_num, None)
                    student_ans_str = letters[student_ans_idx] if student_ans_idx is not None else None
                    
                    if student_ans_str == expected:
                        correct_for_sheet += 1
                        stats['correct_comparisons'] += 1
                        
                    stats['total_question_comparisons'] += 1
                    
                acc_pct = (correct_for_sheet / total_questions) * 100
                table.add_row(img_path.name, "SUCCESS", f"{acc_pct:.1f}%", str(elapsed_ms))
            else:
                stats['failed_reads'] += 1
                table.add_row(img_path.name, "FAILED", "-", str(elapsed_ms))
                
        except Exception as e:
            stats['failed_reads'] += 1
            table.add_row(img_path.name, "ERROR", str(e), "-")

    # Output results
    console.print("\n")
    console.print(table)
    
    console.print("\n[bold]Final Benchmark Metrics[/bold]")
    console.print(f"Total Sheets Processed: {stats['total_images']}")
    console.print(f"Successful Sheet Reads: {stats['successful_reads']} ({stats['successful_reads']/stats['total_images']*100:.1f}%)")
    
    if stats['total_question_comparisons'] > 0:
        overall_accuracy = (stats['correct_comparisons'] / stats['total_question_comparisons']) * 100
        console.print(f"Overall Bubble Read Accuracy: {overall_accuracy:.2f}% ({stats['correct_comparisons']}/{stats['total_question_comparisons']} bubbles)")
        
    avg_time = stats['total_time_ms'] / stats['total_images'] if stats['total_images'] else 0
    console.print(f"Average Processing Time: {avg_time:.0f} ms per sheet")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Markix OMR Accuracy Benchmark")
    parser.add_argument("--dataset", type=str, default="../dummy_dataset", help="Path to folder containing test images")
    parser.add_argument("--key", type=str, default="../dataset/answer_key.json", help="Path to reference answer key JSON")
    args = parser.parse_args()
    
    # Needs rich standard output
    try:
        import rich
    except ImportError:
        os.system("pip install rich")
        
    run_accuracy_test(args.dataset, args.key)
