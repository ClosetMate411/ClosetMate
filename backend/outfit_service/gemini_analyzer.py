"""
Gemini Clothing Analyzer - Extracts structured clothing attributes from images
Uses Gemini 2.0 Flash with strict JSON schema enforcement to minimize hallucination
"""
import os
import json
import base64
import logging
from typing import Optional

import google.generativeai as genai

logger = logging.getLogger(__name__)


def repair_json(text: str) -> str:
    """
    Aggressively repair malformed JSON from Gemini.
    Handles: markdown fences, single quotes, trailing commas, comments,
    unquoted keys, unterminated strings, missing brackets.
    """
    import re

    text = text.strip()

    # Remove markdown code fences
    if text.startswith("```"):
        lines = text.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(lines).strip()

    # Try as-is
    try:
        json.loads(text)
        return text
    except json.JSONDecodeError:
        pass

    # Remove single-line comments (// ...)
    text = re.sub(r'//[^\n]*', '', text)

    # Remove trailing commas before } or ]
    text = re.sub(r',\s*([}\]])', r'\1', text)

    # Replace single-quoted keys and values with double quotes
    text = re.sub(r"(?<=[{,\[])\s*'([^']+)'\s*:", r' "\1":', text)
    text = re.sub(r":\s*'([^']*)'", r': "\1"', text)

    # Fix unquoted keys: word: → "word":
    text = re.sub(r'(?<=[{,\n])\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:', r' "\1":', text)

    # Try again
    try:
        json.loads(text)
        return text
    except json.JSONDecodeError:
        pass

    # Fix unterminated strings
    in_string = False
    escaped = False
    for ch in text:
        if escaped:
            escaped = False
            continue
        if ch == '\\':
            escaped = True
            continue
        if ch == '"':
            in_string = not in_string
    if in_string:
        text += '"'

    # Close open brackets/braces
    opens = []
    in_string = False
    escaped = False
    for ch in text:
        if escaped:
            escaped = False
            continue
        if ch == '\\':
            escaped = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch in '{[':
            opens.append(ch)
        elif ch == '}' and opens and opens[-1] == '{':
            opens.pop()
        elif ch == ']' and opens and opens[-1] == '[':
            opens.pop()

    for bracket in reversed(opens):
        text += ']' if bracket == '[' else '}'

    return text

# Configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY environment variable is required")

genai.configure(api_key=GEMINI_API_KEY)

# Gemini 2.5 Flash — better JSON compliance, reasoning, same speed/cost tier
MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

# ============== STRICT SCHEMA DEFINITIONS ==============
# These mirror the database columns exactly - Gemini must conform to this

VALID_CATEGORIES = [
    "top", "bottom", "outerwear", "footwear",
    "dress", "activewear", "accessory", "swimwear"
]

VALID_SUBCATEGORIES = {
    "top": ["t-shirt", "shirt", "blouse", "polo", "tank-top", "sweater",
            "hoodie", "cardigan", "crop-top", "turtleneck", "henley", "vest"],
    "bottom": ["jeans", "chinos", "trousers", "shorts", "skirt",
               "sweatpants", "cargo-pants", "leggings", "culottes"],
    "outerwear": ["jacket", "blazer", "coat", "parka", "windbreaker",
                  "denim-jacket", "leather-jacket", "bomber", "trench-coat",
                  "puffer-jacket", "raincoat", "vest"],
    "footwear": ["sneakers", "boots", "loafers", "sandals", "heels",
                 "flats", "oxford", "derby", "mules", "espadrilles"],
    "dress": ["casual-dress", "formal-dress", "maxi-dress", "mini-dress",
              "midi-dress", "sundress", "cocktail-dress", "shirt-dress"],
    "activewear": ["sports-bra", "athletic-shorts", "track-pants",
                   "compression-top", "yoga-pants", "jersey"],
    "accessory": ["hat", "scarf", "belt", "tie", "bow-tie", "watch",
                  "bag", "sunglasses", "gloves", "jewelry"],
    "swimwear": ["bikini", "one-piece", "swim-trunks", "board-shorts"],
}

VALID_COLORS = [
    "black", "white", "gray", "navy", "blue", "light-blue", "sky-blue",
    "red", "burgundy", "maroon", "pink", "hot-pink", "blush",
    "green", "olive", "forest-green", "mint", "sage", "teal",
    "yellow", "mustard", "gold",
    "orange", "coral", "peach",
    "purple", "lavender", "plum",
    "brown", "tan", "beige", "camel", "cream", "ivory",
    "khaki", "charcoal", "silver", "rose-gold", "denim-blue",
    "multicolor"
]

VALID_PATTERNS = [
    "solid", "striped", "plaid", "checkered", "polka-dot",
    "floral", "paisley", "geometric", "abstract", "animal-print",
    "camo", "tie-dye", "color-block", "herringbone", "houndstooth",
    "graphic", "logo", "tropical", "argyle"
]

VALID_MATERIALS = [
    "cotton", "polyester", "denim", "leather", "suede", "wool",
    "silk", "linen", "cashmere", "nylon", "velvet", "corduroy",
    "fleece", "satin", "chiffon", "tweed", "knit", "mesh",
    "canvas", "synthetic", "mixed", "unknown"
]

VALID_STYLES = [
    "casual", "formal", "business-casual", "smart-casual",
    "sporty", "streetwear", "bohemian", "minimalist",
    "preppy", "vintage", "classic", "trendy", "elegant",
    "punk", "grunge", "athleisure", "workwear", "resort"
]

VALID_FIT = [
    "slim", "regular", "relaxed", "oversized", "tailored", "cropped", "fitted"
]

VALID_OCCASIONS = [
    "everyday", "work", "formal-event", "date-night", "party",
    "outdoor", "gym", "beach", "travel", "lounging", "wedding"
]

VALID_WEATHER = ["hot", "warm", "mild", "cool", "cold", "all-weather"]


# ============== ANALYSIS PROMPT ==============

CLOTHING_ANALYSIS_PROMPT = """You are a professional fashion analyst. Analyze the clothing item in this image and extract its attributes.

CRITICAL RULES:
1. ONLY describe what you can actually see in the image. Do NOT guess or hallucinate.
2. If you cannot determine an attribute clearly, use the fallback value specified.
3. Respond with ONLY valid JSON - no markdown, no explanation, no extra text.
4. Every field must use ONLY values from the allowed lists below.

REQUIRED JSON SCHEMA:
{
  "category": one of """ + json.dumps(VALID_CATEGORIES) + """,
  "subcategory": one of the values listed under the detected category (see below),
  "color_primary": one of """ + json.dumps(VALID_COLORS) + """,
  "color_secondary": one of """ + json.dumps(VALID_COLORS) + """ or null if single color,
  "pattern": one of """ + json.dumps(VALID_PATTERNS) + """,
  "material": one of """ + json.dumps(VALID_MATERIALS) + """,
  "style": one of """ + json.dumps(VALID_STYLES) + """,
  "fit": one of """ + json.dumps(VALID_FIT) + """,
  "formality_level": integer 1-5 (1=very casual, 5=very formal),
  "weather_suitability": list of one or more from """ + json.dumps(VALID_WEATHER) + """,
  "suitable_occasions": list of one or more from """ + json.dumps(VALID_OCCASIONS) + """,
  "description": a brief 1-2 sentence factual description of the item (max 150 chars)
}

SUBCATEGORY VALUES BY CATEGORY:
""" + json.dumps(VALID_SUBCATEGORIES, indent=2) + """

FALLBACK VALUES (use when unsure):
- material: "unknown"
- color_secondary: null
- pattern: "solid"
- fit: "regular"
- formality_level: 2
- weather_suitability: ["mild"]
- suitable_occasions: ["everyday"]

Respond with ONLY the JSON object. No other text."""


OUTFIT_GENERATION_PROMPT = """You are a professional fashion stylist. Create outfit combinations from the pre-filtered wardrobe items below.

IMPORTANT: These items have ALREADY been filtered by occasion, season, and formality on the server side.
ALL provided items are valid candidates — your job is to combine them into great outfits, NOT to re-filter them.

RULES:
1. Each outfit MUST use only items from the provided wardrobe — reference them by their exact "id" field.
2. An outfit should have 2-5 items that work together aesthetically.
3. Consider color harmony, style consistency, and overall cohesion.
4. Do NOT repeat the same item across outfits unless the user has very few items.
5. Respond with ONLY valid JSON — no markdown, no explanation.
6. Each outfit must have a short creative name and a brief explanation of why it works.
7. Rate each outfit's cohesion from 1-10.
8. You MUST generate at least 1 outfit if 2 or more items are provided. NEVER return an empty list when items are available.

USER'S WARDROBE (pre-filtered):
{wardrobe_items}

CONTEXT (for naming/reasoning only, do NOT use these to exclude items):
- Season: {season}
- Occasion: {occasion}
- Style preference: {style}

Generate up to {count} outfit combinations. Prioritize quality and variety.

REQUIRED JSON SCHEMA:
{{
  "outfits": [
    {{
      "name": "Creative outfit name (max 50 chars)",
      "item_ids": ["id1", "id2", ...],
      "style": "overall style of the outfit",
      "occasion": "best occasion for this outfit",
      "season": "best season for this outfit",
      "cohesion_score": integer 1-10,
      "reasoning": "REQUIRED - 1-2 sentence explanation of why these items work together. NEVER leave empty. (max 200 chars)"
    }}
  ]
}}

Respond with ONLY the JSON object."""


# ============== ANALYZER CLASS ==============

class GeminiClothingAnalyzer:
    """Handles all Gemini API interactions for clothing analysis and outfit generation"""

    def __init__(self):
        self.model = genai.GenerativeModel(
            model_name=MODEL_NAME,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                temperature=0.1,  # Low temperature = more deterministic, less hallucination
                max_output_tokens=1024,
            ),
        )
        self.outfit_model = genai.GenerativeModel(
            model_name=MODEL_NAME,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                temperature=0.7,  # Higher for creative outfit combinations
                max_output_tokens=4096,
            ),
        )

    async def analyze_clothing(self, image_bytes: bytes, mime_type: str = "image/png") -> dict:
        """
        Analyze a clothing image and return structured attributes.
        
        Args:
            image_bytes: Raw image bytes (processed/bg-removed image)
            mime_type: MIME type of the image
            
        Returns:
            Dict with validated clothing attributes
            
        Raises:
            ValueError: If Gemini response fails validation
            Exception: If Gemini API call fails
        """
        image_part = {
            "mime_type": mime_type,
            "data": base64.b64encode(image_bytes).decode("utf-8")
        }

        last_error = None
        for attempt in range(3):
            try:
                response = await self.model.generate_content_async(
                    [CLOTHING_ANALYSIS_PROMPT, image_part]
                )

                try:
                    result = json.loads(response.text)
                except json.JSONDecodeError:
                    logger.warning(f"Clothing analysis JSON parse failed (attempt {attempt+1}), repairing...")
                    repaired = repair_json(response.text)
                    result = json.loads(repaired)

                validated = self._validate_analysis(result)
                logger.info(f"Clothing analysis successful: {validated.get('category')}/{validated.get('subcategory')}")
                return validated

            except json.JSONDecodeError as e:
                last_error = e
                logger.warning(f"Clothing analysis attempt {attempt+1}/3 failed: {e}")
            except Exception as e:
                logger.error(f"Gemini API error: {e}")
                raise

        logger.error(f"Gemini returned invalid JSON after 3 attempts: {last_error}")
        raise ValueError(f"Failed to parse Gemini response after 3 attempts: {last_error}")

    async def generate_outfits(
        self,
        wardrobe_items: list[dict],
        count: int = 3,
        season: str = "all",
        occasion: str = "everyday",
        style: str = "any"
    ) -> dict:
        """
        Generate outfit combinations from the user's wardrobe.
        Uses item_id (wardrobe item ID) as the reference key.
        Includes retry logic and JSON repair for robustness.
        """
        if len(wardrobe_items) < 2:
            raise ValueError("Need at least 2 items to generate an outfit")

        count = max(1, min(count, 10))

        # Build the prompt with actual wardrobe data
        # Use item_id as the ID field so outfit references map to wardrobe items
        simplified_items = []
        for item in wardrobe_items:
            simplified_items.append({
                "id": item.get("item_id", item["id"]),  # Use item_id (wardrobe FK)
                "category": item.get("category", "unknown"),
                "subcategory": item.get("subcategory", "unknown"),
                "color_primary": item.get("color_primary", "unknown"),
                "color_secondary": item.get("color_secondary"),
                "pattern": item.get("pattern", "solid"),
                "style": item.get("style", "casual"),
                "formality_level": item.get("formality_level", 2),
                "weather_suitability": item.get("weather_suitability", ["mild"]),
                "suitable_occasions": item.get("suitable_occasions", ["everyday"]),
            })

        prompt = OUTFIT_GENERATION_PROMPT.format(
            wardrobe_items=json.dumps(simplified_items, indent=2),
            season=season,
            occasion=occasion,
            style=style,
            count=count,
        )

        # Retry until valid JSON (up to 3 attempts)
        last_error = None
        for attempt in range(3):
            try:
                response = await self.outfit_model.generate_content_async(prompt)
                raw_text = response.text

                try:
                    result = json.loads(raw_text)
                except json.JSONDecodeError:
                    logger.warning(f"Outfit JSON parse failed (attempt {attempt+1}/3), repairing...")
                    repaired = repair_json(raw_text)
                    result = json.loads(repaired)

                valid_ids = {item.get("item_id", item["id"]) for item in wardrobe_items}
                validated = self._validate_outfits(result, valid_ids)
                logger.info(f"Generated {len(validated['outfits'])} outfit combinations")
                return validated

            except (json.JSONDecodeError, ValueError) as e:
                last_error = e
                logger.warning(f"Outfit generation attempt {attempt+1}/3 failed: {e}")
                continue
            except Exception as e:
                logger.error(f"Gemini API error during outfit generation: {e}")
                raise

        raise ValueError(f"Failed to generate outfits after 3 attempts: {last_error}")

    # ============== VALIDATION ==============

    def _validate_analysis(self, data: dict) -> dict:
        """Validate and sanitize Gemini's clothing analysis response"""
        validated = {}

        # Category
        cat = data.get("category", "").lower()
        validated["category"] = cat if cat in VALID_CATEGORIES else "top"

        # Subcategory - must belong to the detected category
        subcat = data.get("subcategory", "").lower()
        valid_subs = VALID_SUBCATEGORIES.get(validated["category"], [])
        validated["subcategory"] = subcat if subcat in valid_subs else (valid_subs[0] if valid_subs else "unknown")

        # Colors
        color_primary = data.get("color_primary", "").lower()
        validated["color_primary"] = color_primary if color_primary in VALID_COLORS else "black"

        color_secondary = data.get("color_secondary")
        if color_secondary and color_secondary.lower() in VALID_COLORS:
            validated["color_secondary"] = color_secondary.lower()
        else:
            validated["color_secondary"] = None

        # Pattern
        pattern = data.get("pattern", "").lower()
        validated["pattern"] = pattern if pattern in VALID_PATTERNS else "solid"

        # Material
        material = data.get("material", "").lower()
        validated["material"] = material if material in VALID_MATERIALS else "unknown"

        # Style
        style = data.get("style", "").lower()
        validated["style"] = style if style in VALID_STYLES else "casual"

        # Fit
        fit = data.get("fit", "").lower()
        validated["fit"] = fit if fit in VALID_FIT else "regular"

        # Formality level (1-5)
        formality = data.get("formality_level", 2)
        validated["formality_level"] = max(1, min(5, int(formality))) if isinstance(formality, (int, float)) else 2

        # Weather suitability
        weather = data.get("weather_suitability", ["mild"])
        if isinstance(weather, list):
            validated["weather_suitability"] = [w for w in weather if w in VALID_WEATHER] or ["mild"]
        else:
            validated["weather_suitability"] = ["mild"]

        # Suitable occasions
        occasions = data.get("suitable_occasions", ["everyday"])
        if isinstance(occasions, list):
            validated["suitable_occasions"] = [o for o in occasions if o in VALID_OCCASIONS] or ["everyday"]
        else:
            validated["suitable_occasions"] = ["everyday"]

        # Description - truncate and sanitize
        desc = data.get("description", "")
        validated["description"] = str(desc)[:150] if desc else ""

        return validated

    def _validate_outfits(self, data: dict, valid_ids: set) -> dict:
        """Validate outfit generation response - ensure all item IDs exist"""
        validated_outfits = []
        for outfit in data.get("outfits", []):
            item_ids = outfit.get("item_ids", [])
            # Filter to only valid item IDs
            valid_item_ids = [iid for iid in item_ids if iid in valid_ids]

            if len(valid_item_ids) < 2:
                continue  # Skip outfits with fewer than 2 valid items

            validated_outfits.append({
                "name": str(outfit.get("name", "Unnamed Outfit"))[:50],
                "item_ids": valid_item_ids,
                "style": str(outfit.get("style", "casual"))[:30],
                "occasion": str(outfit.get("occasion", "everyday"))[:30],
                "season": str(outfit.get("season", "all"))[:20],
                "cohesion_score": max(1, min(10, int(outfit.get("cohesion_score", 5)))),
                "reasoning": str(outfit.get("reasoning", ""))[:200],
            })

        return {"outfits": validated_outfits}


# Singleton instance
analyzer = GeminiClothingAnalyzer()