from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
import uuid
from datetime import datetime
from ..database import get_db
from ..models.green_project import GreenProjectCreate

router = APIRouter(prefix="/projects", tags=["Green Projects"])

def city_filter(city: str) -> dict:
    clean = city.strip()
    return {"$in": [clean, f"{clean} City", clean.replace(" City", "")]}

@router.get("/")
async def list_projects(city: Optional[str] = None, db=Depends(get_db)):
    query = {}
    if city:
        query["city"] = city_filter(city)
    projects = await db.green_projects.find(query, {"_id": 0}).to_list(length=500)
    return projects

@router.get("/{project_id}")
async def get_project(project_id: str, db=Depends(get_db)):
    proj = await db.green_projects.find_one({"project_id": project_id}, {"_id": 0})
    if not proj:
        raise HTTPException(404, "Project not found")
    return proj

@router.post("/")
async def create_project(project: GreenProjectCreate, db=Depends(get_db)):
    doc = project.model_dump()
    doc["project_id"] = str(uuid.uuid4())
    doc["created_at"] = datetime.utcnow()
    await db.green_projects.insert_one(doc)
    doc.pop("_id", None)
    return doc

@router.patch("/{project_id}/lifecycle")
async def update_lifecycle(project_id: str, lifecycle_stage: str, db=Depends(get_db)):
    valid = ["Proposed", "Approved", "Under Construction", "Completed"]
    if lifecycle_stage not in valid:
        raise HTTPException(400, f"lifecycle_stage must be one of {valid}")
    result = await db.green_projects.update_one(
        {"project_id": project_id},
        {"$set": {"lifecycle_stage": lifecycle_stage, "updated_at": datetime.utcnow()}}
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Project not found")
    return {"project_id": project_id, "lifecycle_stage": lifecycle_stage}
