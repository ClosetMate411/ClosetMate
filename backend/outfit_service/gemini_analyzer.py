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
  "name": "Short display name combining color + material + subcategory (e.g. 'Black Cotton T-Shirt'), max 40 chars",
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


# ============== OUTFIT CATEGORY MAPPING ==============
# Maps DB analysis categories to the 7 outfit-generation categories
# used in the hard rules: TOP, BOTTOM, DRESS, SHOES, OUTERWEAR, BAG, ACCESSORY

_DIRECT_CAT_MAP = {
    "top": "TOP",
    "bottom": "BOTTOM",
    "outerwear": "OUTERWEAR",
    "footwear": "SHOES",
    "dress": "DRESS",
}
_ACTIVEWEAR_TOPS = {"sports-bra", "compression-top", "jersey"}
_SWIMWEAR_DRESSES = {"bikini", "one-piece"}
_BAG_SUBCATEGORIES = {"bag", "backpack", "tote", "clutch", "purse", "handbag", "crossbody"}


def map_to_outfit_category(category: str, subcategory: str = "") -> str:
    """Map a DB analysis category/subcategory to one of the 7 outfit categories."""
    cat = (category or "").lower()
    sub = (subcategory or "").lower()

    if cat in _DIRECT_CAT_MAP:
        return _DIRECT_CAT_MAP[cat]
    if cat == "accessory":
        return "BAG" if sub in _BAG_SUBCATEGORIES else "ACCESSORY"
    if cat == "activewear":
        return "TOP" if sub in _ACTIVEWEAR_TOPS else "BOTTOM"
    if cat == "swimwear":
        return "DRESS" if sub in _SWIMWEAR_DRESSES else "BOTTOM"
    return "ACCESSORY"  # safe fallback


OUTFIT_GENERATION_PROMPT = """You are ClosetMate Outfit Generator, a professional fashion stylist.

Create outfit combinations from the pre-filtered wardrobe items below.
These items have ALREADY been filtered by occasion and formality — ALL are valid candidates.
Your job is to combine them into great outfits, NOT to re-filter them.

CATEGORIES: TOP, BOTTOM, DRESS, SHOES, OUTERWEAR, BAG, ACCESSORY

HARD RULES (must NEVER be violated):
Every outfit MUST be EITHER:
  A) 1 TOP + 1 BOTTOM + 1 SHOES
  OR B) 1 DRESS + 1 SHOES
Optional extras: 0-1 OUTERWEAR, 0-1 BAG, 0-2 ACCESSORY
- BAG / ACCESSORY / OUTERWEAR can NEVER replace missing required items.
- Never output an outfit missing a required category.

SELECTION RULES:
- Each outfit MUST reference items by their exact "id" field.
- Consider color harmony, style consistency, and overall cohesion.
- Items CAN be reused across different outfits (e.g. same shoes in outfit 1 and 3 is fine).
- Do NOT duplicate the same item within a single outfit.
- If DRESS items exist in the wardrobe, at least 1 outfit MUST use Option B (DRESS + SHOES).
- You MUST generate at least 1 outfit if items are sufficient. NEVER return an empty list.

WARDROBE ITEMS:
{wardrobe_items}

WEATHER AWARENESS:
Each item has a weather_suitability field. Do NOT combine incompatible weather items
in the same outfit (e.g. no winter coat + shorts). Keep weather tags consistent within each outfit.

CONTEXT (for naming/reasoning only, do NOT use to exclude items):
- Occasion: {occasion}
- Style preference: {style}

CRITICAL COUNT RULE:
You MUST return a JSON array with EXACTLY {count} outfit objects.
If you return fewer than {count}, your response will be REJECTED.
Count the outfits before responding. Each outfit must use DIFFERENT item combinations.
Validate each against HARD RULES before output.

REQUIRED JSON (strict JSON only, no extra text):
{{
  "outfits": [
    {{
      "title": "Creative outfit name (max 50 chars)",
      "required": [
        {{"id": "item_id_here", "category": "TOP"}},
        {{"id": "item_id_here", "category": "BOTTOM"}},
        {{"id": "item_id_here", "category": "SHOES"}}
      ],
      "optional": [
        {{"id": "item_id_here", "category": "OUTERWEAR"}}
      ],
      "tags": ["casual", "spring"],
      "cohesion_score": 8,
      "explanation": "1-2 sentences on why these items work together (max 1000 chars)"
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
        occasion: str = "everyday",
        style: str = "any",
    ) -> dict:
        """
        Generate outfit combinations from the user's wardrobe.
        Enforces hard rules: TOP+BOTTOM+SHOES or DRESS+SHOES.
        """
        if len(wardrobe_items) < 2:
            raise ValueError("Need at least 2 items to generate an outfit")

        count = max(1, min(count, 10))

        # Build simplified items with mapped outfit categories
        simplified_items = []
        items_by_category: dict[str, list[dict]] = {}

        for item in wardrobe_items:
            item_id = item["id"]
            outfit_cat = map_to_outfit_category(
                item.get("category", "unknown"),
                item.get("subcategory", ""),
            )
            simplified = {
                "id": item_id,
                "category": outfit_cat,
                "subcategory": item.get("subcategory", "unknown"),
                "color_primary": item.get("color_primary", "unknown"),
                "color_secondary": item.get("color_secondary"),
                "pattern": item.get("pattern", "solid"),
                "style": item.get("style", "casual"),
                "formality_level": item.get("formality_level", 2),
                "weather_suitability": item.get("weather_suitability", ["mild"]),
            }
            simplified_items.append(simplified)
            items_by_category.setdefault(outfit_cat, []).append(simplified)

        # Pre-check: need TOP+BOTTOM+SHOES (option A) or DRESS+SHOES (option B)
        has_option_a = all(
            cat in items_by_category for cat in ("TOP", "BOTTOM", "SHOES")
        )
        has_option_b = all(
            cat in items_by_category for cat in ("DRESS", "SHOES")
        )
        if not (has_option_a or has_option_b):
            raise ValueError(
                "Not enough items to form an outfit: need (TOP + BOTTOM + SHOES) or (DRESS + SHOES)"
            )

        valid_ids = {item["id"] for item in wardrobe_items}

        prompt = OUTFIT_GENERATION_PROMPT.format(
            wardrobe_items=json.dumps(simplified_items, indent=2),
            occasion=occasion,
            style=style,
            count=count,
        )

        # ── First pass: generate outfits ──
        outfits = await self._call_gemini_for_outfits(
            prompt, valid_ids, items_by_category
        )

        # ── Retry up to 2 times if Gemini returned fewer than requested ──
        for retry in range(2):
            if len(outfits) >= count:
                break

            remaining = count - len(outfits)
            existing_combos = [
                sorted(o["item_ids"]) for o in outfits
            ]
            logger.warning(
                f"Retry {retry+1}/2: Gemini returned {len(outfits)}/{count} outfits, "
                f"requesting {remaining} more"
            )

            retry_prompt = OUTFIT_GENERATION_PROMPT.format(
                wardrobe_items=json.dumps(simplified_items, indent=2),
                occasion=occasion,
                style=style,
                count=remaining,
            ) + f"\n\nALREADY GENERATED (do NOT repeat these exact combinations):\n{json.dumps(existing_combos)}"

            extra = await self._call_gemini_for_outfits(
                retry_prompt, valid_ids, items_by_category
            )

            # Deduplicate: only add outfits with different item combos
            for outfit in extra:
                combo = sorted(outfit["item_ids"])
                if combo not in existing_combos:
                    outfits.append(outfit)
                    existing_combos.append(combo)
                if len(outfits) >= count:
                    break

            logger.info(
                f"After retry {retry+1}/2: {len(outfits)}/{count} outfits"
            )

        return {"outfits": outfits[:count]}

    async def _call_gemini_for_outfits(
        self,
        prompt: str,
        valid_ids: set,
        items_by_category: dict,
    ) -> list[dict]:
        """
        Send prompt to Gemini and return validated outfit list.
        Retries up to 3 times on JSON parse failures.
        """
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

                validated = self._validate_outfits(
                    result, valid_ids, items_by_category
                )
                logger.info(f"Gemini returned {len(validated['outfits'])} valid outfits")
                return validated["outfits"]

            except (json.JSONDecodeError, ValueError) as e:
                last_error = e
                logger.warning(f"Outfit generation attempt {attempt+1}/3 failed: {e}")
                continue
            except Exception as e:
                logger.error(f"Gemini API error during outfit generation: {e}")
                raise

        logger.error(f"Failed to get valid outfits after 3 attempts: {last_error}")
        return []

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

        # Name — AI-generated display name, fallback to "Color Subcategory"
        name = data.get("name", "")
        if name:
            validated["name"] = str(name)[:40]
        else:
            validated["name"] = f"{validated['color_primary'].title()} {validated['subcategory'].replace('-', ' ').title()}"[:40]

        # Description - truncate and sanitize
        desc = data.get("description", "")
        validated["description"] = str(desc)[:150] if desc else ""

        return validated

    def _validate_outfits(
        self,
        data: dict,
        valid_ids: set,
        items_by_category: dict | None = None,
    ) -> dict:
        """
        Validate outfit generation response — enforce HARD RULES.
        Every outfit must be TOP+BOTTOM+SHOES (option A) or DRESS+SHOES (option B).
        Attempts to repair outfits missing required categories before discarding.
        """
        items_by_category = items_by_category or {}
        validated_outfits = []
        used_ids: set[str] = set()  # track used items for repair diversity

        for outfit in data.get("outfits", []):
            required = outfit.get("required", [])
            optional = outfit.get("optional", [])

            # ── Fallback: convert old flat item_ids format to required/optional ──
            if not required and "item_ids" in outfit:
                for iid in outfit["item_ids"]:
                    cat_found = None
                    for cat, items in items_by_category.items():
                        if any(it["id"] == iid for it in items):
                            cat_found = cat
                            break
                    if cat_found and cat_found in ("TOP", "BOTTOM", "SHOES", "DRESS"):
                        required.append({"id": iid, "category": cat_found})
                    else:
                        optional.append({"id": iid, "category": cat_found or "ACCESSORY"})

            # ── Filter to valid IDs only ──
            required = [r for r in required if isinstance(r, dict) and r.get("id") in valid_ids]
            optional = [o for o in optional if isinstance(o, dict) and o.get("id") in valid_ids]

            # ── Determine required categories (DRESS+SHOES or TOP+BOTTOM+SHOES) ──
            req_categories = {r.get("category") for r in required}

            if "DRESS" in req_categories:
                needed = {"DRESS", "SHOES"}
            else:
                needed = {"TOP", "BOTTOM", "SHOES"}

            # ── Repair missing required categories ──
            missing = needed - req_categories
            if missing:
                outfit_ids = {r["id"] for r in required} | {o["id"] for o in optional}
                repaired = True
                for cat in missing:
                    # Prefer items not already used in other outfits
                    candidates = [
                        it for it in items_by_category.get(cat, [])
                        if it["id"] not in used_ids and it["id"] not in outfit_ids
                    ]
                    if not candidates:
                        candidates = [
                            it for it in items_by_category.get(cat, [])
                            if it["id"] not in outfit_ids
                        ]
                    if candidates:
                        required.append({"id": candidates[0]["id"], "category": cat})
                    else:
                        repaired = False
                        break

                if not repaired:
                    logger.warning(
                        f"Discarding outfit — cannot satisfy hard rules: "
                        f"missing {needed - {r.get('category') for r in required}}"
                    )
                    continue

            # ── Final hard-rule check ──
            final_cats = {r.get("category") for r in required}
            if not needed.issubset(final_cats):
                continue

            # ── Build backward-compatible item_ids ──
            all_ids = [r["id"] for r in required] + [o["id"] for o in optional]
            used_ids.update(all_ids)

            tags = outfit.get("tags", [])
            if not isinstance(tags, list):
                tags = []

            validated_outfits.append({
                "name": str(outfit.get("title", outfit.get("name", "Unnamed Outfit")))[:50],
                "item_ids": all_ids,
                "required": required,
                "optional": optional,
                "tags": tags,
                "style": tags[0] if tags else "casual",
                "occasion": tags[1] if len(tags) > 1 else "everyday",
                "season": tags[2] if len(tags) > 2 else "all",
                "cohesion_score": max(1, min(10, int(outfit.get("cohesion_score", 5)))),
                "reasoning": str(outfit.get("explanation", outfit.get("reasoning", "")))[:1000],
            })

        return {"outfits": validated_outfits}


# Singleton instance
analyzer = GeminiClothingAnalyzer()