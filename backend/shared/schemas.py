"""
Pydantic Schemas for ClosetMate API
Synchronized with actual database schema
"""
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Any
from datetime import datetime
from enum import Enum


class SeasonEnum(str, Enum):
    SPRING = "Spring"
    SUMMER = "Summer"
    FALL = "Fall"
    WINTER = "Winter"
    UNTITLED = "Untitled"


# ===== User Schemas =====

class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=1, max_length=100)


class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str = Field(..., min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    created_at: Optional[datetime] = None
    last_login: Optional[datetime] = None
    is_verified: bool = False

    class Config:
        from_attributes = True


class UserWithSensitiveData(UserResponse):
    failed_login_attempts: int = 0
    lockout_until: Optional[datetime] = None


# ===== Auth Schemas =====

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str = Field(..., min_length=8, max_length=128)


class PasswordResetTokenResponse(BaseModel):
    id: str
    user_id: str
    expires_at: datetime
    created_at: Optional[datetime] = None
    used: bool = False

    class Config:
        from_attributes = True


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
    user_id: str
    item_name: Optional[str] = "Untitled"
    season: Optional[str] = "Untitled"
    image_url: str
    original_image_url: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

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


# ===== Auth Response Schemas =====

class AuthSuccessResponse(BaseModel):
    success: bool = True
    data: TokenResponse


class UserSuccessResponse(BaseModel):
    success: bool = True
    data: UserResponse


class MessageResponse(BaseModel):
    success: bool = True
    message: str
