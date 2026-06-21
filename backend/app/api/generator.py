from fastapi import APIRouter, Query, Response, Depends
from app.core.omr_generator import generate_omr_sheet
from app.core.deps import require_auth, UserContext
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/generator/omr")
async def get_omr_sheet(
    title: str = Query("OMR Answer Sheet", description="Header title of the sheet"),
    school_name: str = Query("", description="Optional school name"),
    q_count: int = Query(50, ge=10, le=100),
    choices: int = Query(4, ge=2, le=5),
    user: UserContext = Depends(require_auth),
):
    """
    Generate and download a printable OMR sheet.
    """
    try:
        pdf_bytes = generate_omr_sheet(
            title=title,
            school_name=school_name,
            question_count=q_count,
            choices_per_q=choices,
            show_timing_marks=True
        )
        
        filename = f"Markix_{q_count}Q_Sheet.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        logger.exception(f"Sheet generation failed: {e}")
        return {"error": "Failed to generate sheet"}, 500
