# ClosetMate Backend

Microservices-based backend for ClosetMate wardrobe management application.

## Architecture

```
Frontend → API Gateway (Port 3000)
              ↓
        Wardrobe Service (Port 3001) ←→ PostgreSQL
              ↓
        Image Processing Service (Port 3002) ←→ File Storage
```

## Services

| Service | Port | Technology | Description |
|---------|------|------------|-------------|
| API Gateway | 3000 | FastAPI | Routes requests to microservices |
| Wardrobe Service | 3001 | FastAPI + SQLAlchemy | CRUD operations for clothing items |
| Image Processing | 3002 | FastAPI + rembg | Background removal from images |

## Quick Start

### Using Docker Compose (Recommended)

```bash
# Start all services
docker-compose up -d

# Check health of all services
curl http://localhost:3000/api/health/all

# Stop all services
docker-compose down
```

### Manual Setup (Development)

#### 1. Start PostgreSQL

```bash
docker run -d \
  --name closetmate-db \
  -e POSTGRES_USER=closetmate \
  -e POSTGRES_PASSWORD=closetmate123 \
  -e POSTGRES_DB=closetmate_db \
  -p 5432:5432 \
  postgres:15-alpine
```

#### 2. Start Image Processing Service (Port 3002)

```bash
cd image_processing_service
pip install -r requirements.txt
python main.py
```

#### 3. Start Wardrobe Service (Port 3001)

```bash
cd wardrobe_service
pip install -r requirements.txt
python main.py
```

#### 4. Start API Gateway (Port 3000)

```bash
cd api_gateway
pip install -r requirements.txt
python main.py
```

## API Endpoints

### Base URL: `http://localhost:3000/api`

### Wardrobe Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/wardrobe/items` | Get all clothing items |
| GET | `/wardrobe/items/:id` | Get single item |
| POST | `/wardrobe/items` | Create new item (multipart/form-data) |
| PUT | `/wardrobe/items/:id` | Update item |
| DELETE | `/wardrobe/items/:id` | Delete item |

### Image Processing Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/images/process` | Process image (background removal) |
| DELETE | `/images/:filename?type=both` | Delete image files |

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Gateway health |
| GET | `/api/health/all` | All services health |

## Request/Response Examples

### Create Clothing Item

```bash
curl -X POST http://localhost:3000/api/wardrobe/items \
  -F "image=@jacket.jpg" \
  -F "item_name=Blue Jacket" \
  -F "season=Winter"
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "item_name": "Blue Jacket",
    "season": "Winter",
    "image_url": "http://localhost:3002/storage/processed/abc123.png",
    "original_image_url": "http://localhost:3002/storage/original/abc123.jpg",
    "file_name": "abc123.png",
    "file_size": 245600,
    "created_at": "2026-01-01T10:00:00Z",
    "updated_at": "2026-01-01T10:00:00Z"
  }
}
```

### Get All Items

```bash
curl http://localhost:3000/api/wardrobe/items
```

### Update Item

```bash
curl -X PUT http://localhost:3000/api/wardrobe/items/550e8400-e29b-41d4-a716-446655440000 \
  -F "item_name=Updated Jacket" \
  -F "season=Spring"
```

### Delete Item

```bash
curl -X DELETE http://localhost:3000/api/wardrobe/items/550e8400-e29b-41d4-a716-446655440000
```

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

### Error Codes

| Code | Description |
|------|-------------|
| ITEM_NOT_FOUND | Item doesn't exist |
| INVALID_INPUT | Validation error |
| FILE_TOO_LARGE | File exceeds 5MB |
| INVALID_FILE_TYPE | Not an image file |
| PROCESSING_FAILED | Image processing error |
| SERVER_ERROR | Internal server error |

## Database Schema

```sql
CREATE TABLE clothing_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_name VARCHAR(255) NOT NULL DEFAULT 'Untitled',
    season VARCHAR(50) DEFAULT 'Untitled',
    image_url TEXT NOT NULL,
    original_image_url TEXT,
    file_name VARCHAR(255),
    file_size INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_clothing_items_created_at ON clothing_items(created_at DESC);
```

## Valid Season Values

- `Spring`
- `Summer`
- `Fall`
- `Winter`
- `Untitled` (default)

## Image Processing

- **Library**: rembg (u2net model)
- **Supported Formats**: JPG, JPEG, PNG, WEBP
- **Max File Size**: 5MB
- **Output**: PNG with transparent background

## Project Structure

```
closetmate-backend/
├── api_gateway/
│   ├── main.py
│   ├── requirements.txt
│   └── Dockerfile
├── wardrobe_service/
│   ├── main.py
│   ├── requirements.txt
│   └── Dockerfile
├── image_processing_service/
│   ├── main.py
│   ├── requirements.txt
│   └── Dockerfile
├── shared/
│   ├── __init__.py
│   ├── database.py
│   ├── models.py
│   └── schemas.py
├── docker-compose.yml
├── .env.example
└── README.md
```

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://closetmate:closetmate123@localhost:5432/closetmate_db

# Service URLs
WARDROBE_SERVICE_URL=http://localhost:3001
IMAGE_SERVICE_URL=http://localhost:3002

# Image Processing
STORAGE_PATH=./storage
BASE_URL=http://localhost:3002
```

## Development Notes

- FastAPI provides automatic OpenAPI documentation at `/docs`
- Each service has its own Swagger UI:
  - Gateway: http://localhost:3000/docs
  - Wardrobe: http://localhost:3001/docs
  - Image Processing: http://localhost:3002/docs
