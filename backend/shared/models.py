"""
SQLAlchemy Models for ClosetMate
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Text, DateTime, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
import enum

from .database import Base


class SeasonEnum(str, enum.Enum):
    SPRING = "Spring"
    SUMMER = "Summer"
    FALL = "Fall"
    WINTER = "Winter"
    UNTITLED = "Untitled"


class ClothingItem(Base):
    __tablename__ = "clothing_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    item_name = Column(String(255), nullable=False, default="Untitled")
    season = Column(String(50), default="Untitled")
    image_url = Column(Text, nullable=False)
    original_image_url = Column(Text, nullable=True)
    file_name = Column(String(255), nullable=True)
    file_size = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": str(self.id),
            "item_name": self.item_name,
            "season": self.season,
            "image_url": self.image_url,
            "original_image_url": self.original_image_url,
            "file_name": self.file_name,
            "file_size": self.file_size,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None,
            "updated_at": self.updated_at.isoformat() + "Z" if self.updated_at else None,
        }
