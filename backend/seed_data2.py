"""
Seed Script for ClosetMate Production
Run: python seed_production.py
"""
import requests
import os
import time

API_BASE = "https://apigateway-production-b91d.up.railway.app/api"

SAMPLE_ITEMS = [
    {"name": "Black Winter Jacket", "season": "Winter", "image_url": "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400"},
    {"name": "Gray Wool Sweater", "season": "Winter", "image_url": "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=400"},
    {"name": "White T-Shirt", "season": "Summer", "image_url": "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400"},
    {"name": "Blue Denim Shorts", "season": "Summer", "image_url": "https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=400"},
    {"name": "Light Blue Denim Jacket", "season": "Spring", "image_url": "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=400"},
    {"name": "Brown Leather Jacket", "season": "Fall", "image_url": "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400"},
]

def download_image(url, filename):
    print(f"  Downloading: {filename}...")
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    
    os.makedirs("./temp_images", exist_ok=True)
    filepath = f"./temp_images/{filename}"
    
    with open(filepath, "wb") as f:
        f.write(response.content)
    return filepath

def upload_item(name, season, image_path):
    print(f"  Uploading: {name}...")
    
    with open(image_path, "rb") as f:
        files = {"image": (os.path.basename(image_path), f, "image/jpeg")}
        data = {"item_name": name, "season": season}
        
        response = requests.post(
            f"{API_BASE}/wardrobe/items",
            files=files,
            data=data,
            timeout=180
        )
    return response.json()

def seed():
    print("=" * 50)
    print("ClosetMate Production Seeder")
    print("=" * 50)
    
    # Health check
    print("\n[1/3] Health check...")
    try:
        r = requests.get(f"{API_BASE}/health/all", timeout=10)
        if not r.json().get("all_healthy"):
            print("ERROR: Services not healthy")
            return
        print("✓ All services healthy")
    except Exception as e:
        print(f"ERROR: {e}")
        return
    
    # Upload items
    print(f"\n[2/3] Uploading {len(SAMPLE_ITEMS)} items...")
    
    for i, item in enumerate(SAMPLE_ITEMS, 1):
        print(f"\n[{i}/{len(SAMPLE_ITEMS)}] {item['name']}")
        try:
            image_path = download_image(item["image_url"], f"item_{i}.jpg")
            result = upload_item(item["name"], item["season"], image_path)
            
            if result.get("success"):
                print(f"  ✓ Success! ID: {result['data']['id'][:8]}...")
            else:
                print(f"  ✗ Failed: {result.get('error', {}).get('message')}")
        except Exception as e:
            print(f"  ✗ Error: {e}")
        
        time.sleep(2)
    
    # Cleanup
    print("\n[3/3] Cleanup...")
    import shutil
    if os.path.exists("./temp_images"):
        shutil.rmtree("./temp_images")
    print("✓ Done!")
    
    print(f"\nView items: {API_BASE}/wardrobe/items")

if __name__ == "__main__":
    seed()
