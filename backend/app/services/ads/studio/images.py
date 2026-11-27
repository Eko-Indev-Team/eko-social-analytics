"""Ad pictures: validate an uploaded image, or generate a background photo with Pollinations.ai
(port of AdMarketer ``src/creative/image_gen.py``; only when ``AD_STUDIO_IMAGE_PROVIDER=pollinations``).

Not ported: AdMarketer's Playwright compositor (``compose.py``), which overlays logo/headline/CTA boxes on the photo by
rendering HTML in a headless browser. It needs Chromium + Playwright, a heavy new mandatory dependency, so SocialBoard
uploads the picture as-is (Meta shows the copy as the ad text around it). Compose the final picture in a design tool and
upload it if you need text on the image.
"""

from __future__ import annotations

import logging
import random
import urllib.parse

import httpx

logger = logging.getLogger("socialboard.ads.studio")

MAX_IMAGE_BYTES = 8 * 1024 * 1024
MIN_IMAGE_BYTES = 100
ALLOWED_TYPES = ("image/jpeg", "image/png", "image/webp")
POLLINATIONS_URL = "https://image.pollinations.ai/prompt/{prompt}"

ANGLE_SCENES = {
    "general_opportunity": (
        "An Indian bank correspondent kiosk operator, a man around 40 years old with a mustache, plain collared shirt, sitting at "
        "a wooden table with a small biometric fingerprint POS device and receipt printer, helping an elderly Indian woman in a "
        "faded cotton saree with her head covered, and a middle-aged Indian man in a plain kurta."
    ),
    "women_first": (
        "A confident Indian woman kiosk operator in her late 20s-30s, wearing a simple cotton saree or salwar kameez with a small "
        "bindi, sitting at a wooden table with a small biometric fingerprint POS device, helping an elderly Indian woman in a saree "
        "and a village farmer. She looks capable and is treated with respect by her customers."
    ),
    "shop_owner": (
        "An Indian kirana/general store owner, a man around 40-50 with a mustache, standing behind his small shop counter stacked "
        "with everyday goods, who has added a small biometric fingerprint POS device and receipt printer on one side of the "
        "counter, serving a village customer alongside his regular shop business."
    ),
}


class ImageError(Exception):
    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.safe_message = message


def sniff_type(data: bytes) -> str | None:
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def validate(data: bytes, declared_type: str | None) -> str:
    """Returns the real content type; rejects anything that is not a JPEG/PNG/WebP within the size limit."""
    if len(data) > MAX_IMAGE_BYTES:
        raise ImageError(f"The picture is too large (max {MAX_IMAGE_BYTES // (1024 * 1024)} MB).")
    if len(data) < MIN_IMAGE_BYTES:
        raise ImageError("The picture is empty or too small.")
    actual = sniff_type(data)
    if actual is None:
        raise ImageError("Only JPEG, PNG or WebP pictures are accepted.")
    declared = (declared_type or "").split(";")[0].strip().lower()
    if declared and declared != actual and not (declared == "image/jpg" and actual == "image/jpeg"):
        raise ImageError("The picture's content does not match its declared type.")
    return actual


def visual_prompt(brief: dict) -> str:
    scene = ANGLE_SCENES.get(brief.get("angle") or "", ANGLE_SCENES["general_opportunity"])
    product = " ".join(str(brief.get("product") or "").split())[:160]
    style = " ".join(str(brief.get("visual_style") or "warm documentary photo-realistic, natural lighting").split())[:160]
    return (
        "Documentary photojournalism style photo, Canon 5D 85mm lens, shot in a village in Uttar Pradesh India, for a recruitment "
        f"advertisement about: {product}. {scene} Setting: a small brick-walled banking kiosk with a tin roof, dusty village lane and "
        "thatched-roof huts visible in the background, warm golden hour sunlight, realistic South Asian faces and skin tones, "
        "National Geographic style editorial photography, ultra realistic -- this must read as genuinely Indian and rural, not a "
        f"Western or generic stock-photo setting. Additional style notes: {style}. Compose the main subjects slightly right-of-center, "
        "leaving open space on the left third of the frame for a text overlay to be added later. IMPORTANT: no text, no letters, no "
        "logos, no watermark anywhere in the image. High quality, square composition."
    )


def generate_pollinations(brief: dict, *, transport: httpx.BaseTransport | None = None, timeout: float = 60.0, seed: int | None = None) -> tuple[bytes, str]:
    """One 1024×1024 picture from Pollinations.ai (free, third-party, no key; may be slow, change or fail)."""
    url = POLLINATIONS_URL.format(prompt=urllib.parse.quote(visual_prompt(brief)))
    params = {"width": 1024, "height": 1024, "nologo": "true", "seed": seed if seed is not None else random.randint(1, 2**31 - 1)}
    try:
        with httpx.Client(transport=transport, timeout=httpx.Timeout(timeout), follow_redirects=True) as http:
            response = http.get(url, params=params)
    except httpx.HTTPError as exc:
        logger.warning("pollinations image generation failed %s", exc.__class__.__name__)
        raise ImageError("The image service (Pollinations.ai) could not be reached. Try again in a moment, or upload a picture.") from None
    if not response.is_success:
        logger.warning("pollinations image generation http=%s", response.status_code)
        raise ImageError(f"The image service (Pollinations.ai) returned an error ({response.status_code}). Try again, or upload a picture.")
    data = response.content
    try:
        content_type = validate(data, None)
    except ImageError:
        raise ImageError("The image service did not return a usable picture. Try again, or upload a picture.") from None
    return data, content_type
