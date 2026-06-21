"""
answer_key.py
=============
Pydantic models for the answer_keys table.
"""
from __future__ import annotations
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional
from datetime import datetime


# ── Request schemas ───────────────────────────────────────────────────────────

class AnswerKeyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Human-readable key name")
    question_count: int = Field(..., ge=1, le=100, description="Total number of questions")
    choices_per_question: int = Field(..., ge=2, le=5, description="Number of choices per question")
    answers: List[int] = Field(..., description="Correct answer index per question (0-based: 0=A, 1=B…)")

    @field_validator("answers")
    @classmethod
    def validate_answers(cls, v: List[int], info) -> List[int]:
        data = info.data
        qcount = data.get("question_count", 0)
        choices = data.get("choices_per_question", 4)
        if len(v) != qcount:
            raise ValueError(f"answers must have exactly {qcount} items, got {len(v)}")
        for idx, a in enumerate(v):
            if a < 0 or a >= choices:
                raise ValueError(f"Q{idx+1}: answer index {a} out of range for {choices} choices")
        return v


class AnswerKeyUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    answers: Optional[List[int]] = None
    choices_per_question: Optional[int] = Field(None, ge=2, le=5)
    question_count: Optional[int] = Field(None, ge=1, le=100)


# ── Response schemas ──────────────────────────────────────────────────────────

class AnswerKeyResponse(BaseModel):
    id: str
    user_id: str
    name: str
    question_count: int
    choices_per_question: int
    answers: List[int]
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
