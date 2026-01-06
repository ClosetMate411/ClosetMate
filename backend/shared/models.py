"""
SQLAlchemy Models for ClosetMate
Synchronized with actual database schema
"""
from datetime import datetime
from sqlalchemy import Column, String, Integer, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
import enum
import uuid

from .database import Base


class SeasonEnum(str, enum.Enum):
    SPRING = "Spring"
    SUMMER = "Summer"
    FALL = "Fall"
    WINTER = "Winter"
    UNTITLED = "Untitled"


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(254), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)
    failed_login_attempts = Column(Integer, default=0)
    lockout_until = Column(DateTime, nullable=True)
    is_verified = Column(Boolean, default=False)

    # Relationships
    clothing_items = relationship("ClothingItem", back_populates="user", cascade="all, delete-orphan")
    password_reset_tokens = relationship("PasswordResetToken", back_populates="user", cascade="all, delete-orphan")

    def to_dict(self, include_sensitive: bool = False):
        data = {
            "id": self.id,
            "email": self.email,
            "full_name": self.full_name,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None,
            "last_login": self.last_login.isoformat() + "Z" if self.last_login else None,
            "is_verified": self.is_verified,
        }
        if include_sensitive:
            data["failed_login_attempts"] = self.failed_login_attempts
            data["lockout_until"] = self.lockout_until.isoformat() + "Z" if self.lockout_until else None
        return data


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    token = Column(String(255), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    used = Column(Boolean, default=False)

    # Relationships
    user = relationship("User", back_populates="password_reset_tokens")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "expires_at": self.expires_at.isoformat() + "Z" if self.expires_at else None,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None,
            "used": self.used,
        }

    @property
    def is_expired(self) -> bool:
        return datetime.utcnow() > self.expires_at

    @property
    def is_valid(self) -> bool:
        return not self.used and not self.is_expired


class ClothingItem(Base):
    __tablename__ = "clothing_items"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    item_name = Column(String(255), nullable=True, default="Untitled")
    season = Column(String(50), nullable=True, default="Untitled")
    image_url = Column(String, nullable=False)
    original_image_url = Column(String, nullable=True)
    file_name = Column(String(255), nullable=True)
    file_size = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="clothing_items")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "item_name": self.item_name,
            "season": self.season,
            "image_url": self.image_url,
            "original_image_url": self.original_image_url,
            "file_name": self.file_name,
            "file_size": self.file_size,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None,
            "updated_at": self.updated_at.isoformat() + "Z" if self.updated_at else None,
        }
