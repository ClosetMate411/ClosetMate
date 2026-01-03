"""
Pydantic Schemas for ClosetMate API
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime
from enum import Enum
import uuid


class SeasonEnum(str, Enum):
    SPRING = "Spring"
    SUMMER = "Summer"
    FALL = "Fall"
    WINTER = "Winter"
    UNTITLED = "Untitled"


# ===== Clothing Item Schemas =====

class ClothingItemBase(BaseModel):
    item_name: Optional[str] = Field(default="Untitled", max_length=255)
    season: Optional[SeasonEnum] = Field(default=SeasonEnum.UNTITLED)


class ClothingItemCreate(ClothingItemBase):
    pass


class ClothingItemUpdate(BaseModel):
    item_name: Optional[str] = Field(default=None, max_length=255)
    season: Optional[SeasonEnum] = None


class ClothingItemResponse(BaseModel):
    id: str
    item_name: str
    season: str
    image_url: str
    original_image_url: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ===== Image Processing Schemas =====

class ImageProcessResponse(BaseModel):
    original_url: str
    processed_url: str
    file_name: str
    file_size: int


# ===== Generic Response Schemas =====

class SuccessResponse(BaseModel):
    success: bool = True
    data: Any = None
    message: Optional[str] = None


class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    success: bool = False
    error: ErrorDetail


class ListResponse(BaseModel):
    success: bool = True
    data: List[ClothingItemResponse]


class SingleItemResponse(BaseModel):
    success: bool = True
    data: ClothingItemResponse


class ImageProcessSuccessResponse(BaseModel):
    success: bool = True
    data: ImageProcessResponse


class DeleteResponse(BaseModel):
    success: bool = True
    message: str
