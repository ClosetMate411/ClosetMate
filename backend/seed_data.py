"""
Seed Script for ClosetMate - Loads sample clothing data
Run: python seed_data.py
"""
import requests
import os
import time
from pathlib import Path

API_BASE = "http://localhost:3000/api"

# Sample clothing items with free stock image URLs
SAMPLE_ITEMS = [
    # Winter Items
    {
        "name": "Black Winter Jacket",
        "season": "Winter",
        "image_url": "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400"
    },
    {
        "name": "Gray Wool Sweater",
        "season": "Winter",
        "image_url": "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=400"
    },
    {
        "name": "Navy Blue Coat",
        "season": "Winter",
        "image_url": "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=400"
    },
    
    # Summer Items
    {
        "name": "White T-Shirt",
        "season": "Summer",
        "image_url": "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400"
    },
    {
        "name": "Blue Denim Shorts",
        "season": "Summer",
        "image_url": "https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=400"
    },
    {
        "name": "Floral Summer Dress",
        "season": "Summer",
        "image_url": "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=400"
    },
    
    # Spring Items
    {
        "name": "Light Blue Denim Jacket",
        "season": "Spring",
        "image_url": "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=400"
    },
    {
        "name": "Beige Trench Coat",
        "season": "Spring",
        "image_url": "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400"
    },
    {
        "name": "Pink Cardigan",
        "season": "Spring",
        "image_url": "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=400"
    },
    
    # Fall Items
    {
        "name": "Brown Leather Jacket",
        "season": "Fall",
        "image_url": "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400"
    },
    {
        "name": "Burgundy Hoodie",
        "season": "Fall",
        "image_url": "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400"
    },
    {
        "name": "Olive Green Cargo Pants",
        "season": "Fall",
        "image_url": "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=400"
    },
]

def download_image(url: str, filename: str) -> str:
    """Download image from URL and save locally"""
    print(f"  Downloading: {filename}...")
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    
    filepath = f"./temp_images/{filename}"
    os.makedirs("./temp_images", exist_ok=True)
    
    with open(filepath, "wb") as f:
        f.write(response.content)
    
    return filepath


def upload_item(name: str, season: str, image_path: str) -> dict:
    """Upload clothing item to API"""
    print(f"  Uploading: {name}...")
    
    with open(image_path, "rb") as f:
        files = {"image": (os.path.basename(image_path), f, "image/jpeg")}
        data = {"item_name": name, "season": season}
        
        response = requests.post(
            f"{API_BASE}/wardrobe/items",
            files=files,
            data=data,
            timeout=120  # Background removal takes time
        )
    
    return response.json()


def check_api_health():
    """Check if API is running"""
    try:
        response = requests.get(f"{API_BASE}/health/all", timeout=5)
        data = response.json()
        return data.get("all_healthy", False)
    except Exception as e:
        print(f"API not available: {e}")
        return False


def seed_database():
    """Main seeding function"""
    print("=" * 50)
    print("ClosetMate Sample Data Seeder")
    print("=" * 50)
    
    # Check API health
    print("\n[1/3] Checking API health...")
    if not check_api_health():
        print("ERROR: API is not healthy. Make sure docker-compose is running.")
        return False
    print("✓ API is healthy")
    
    # Download and upload each item
    print(f"\n[2/3] Uploading {len(SAMPLE_ITEMS)} sample items...")
    print("(This may take a while due to background removal processing)\n")
    
    successful = 0
    failed = 0
    
    for i, item in enumerate(SAMPLE_ITEMS, 1):
        print(f"[{i}/{len(SAMPLE_ITEMS)}] {item['name']} ({item['season']})")
        
        try:
            # Download image
            filename = f"item_{i}.jpg"
            image_path = download_image(item["image_url"], filename)
            
            # Upload to API
            result = upload_item(item["name"], item["season"], image_path)
            
            if result.get("success"):
                print(f"  ✓ Success! ID: {result['data']['id'][:8]}...")
                successful += 1
            else:
                print(f"  ✗ Failed: {result.get('error', {}).get('message', 'Unknown error')}")
                failed += 1
                
        except Exception as e:
            print(f"  ✗ Error: {str(e)}")
            failed += 1
        
        # Small delay between uploads
        time.sleep(1)
    
    # Cleanup temp images
    print("\n[3/3] Cleaning up temporary files...")
    import shutil
    if os.path.exists("./temp_images"):
        shutil.rmtree("./temp_images")
    print("✓ Cleanup complete")
    
    # Summary
    print("\n" + "=" * 50)
    print("SEEDING COMPLETE")
    print("=" * 50)
    print(f"✓ Successful: {successful}")
    print(f"✗ Failed: {failed}")
    print(f"\nView items at: http://localhost:3000/api/wardrobe/items")
    print("Swagger UI: http://localhost:3000/docs")
    
    return failed == 0


if __name__ == "__main__":
    seed_database()
