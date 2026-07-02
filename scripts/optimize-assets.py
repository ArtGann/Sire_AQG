from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
IMAGES = ROOT / "assets" / "img"


def webp(source: str, target: str, *, max_width: int | None = None, quality: int = 82, lossless: bool = False) -> None:
    image = Image.open(IMAGES / source)
    if max_width and image.width > max_width:
        height = round(image.height * max_width / image.width)
        image = image.resize((max_width, height), Image.Resampling.LANCZOS)
    image.save(IMAGES / target, "WEBP", quality=quality, method=6, lossless=lossless)


webp("logo-site.png", "logo-site.webp", max_width=480, lossless=True)
webp("logo-site-footer.png", "logo-site-footer.webp", max_width=480, lossless=True)
webp("hero-bg-source-match.jpg", "hero-bg-source-match.webp", quality=82)
webp("service-area-map.png", "service-area-map.webp", max_width=1200, quality=82)
webp("service-area-map-pa-nj.png", "service-area-map-pa-nj.webp", max_width=1672, quality=82)
webp("faq-wave-source.png", "faq-wave.webp", max_width=1806, quality=88)

for number in range(1, 7):
    webp(f"service-{number}-generated.jpg", f"service-{number}-generated.webp", max_width=1000, quality=82)

for source in [
    "project-1-after-generated.jpg", "project-1-before-generated.jpg",
    "project-2-after-generated.jpg", "project-2-before-generated.jpg",
    "project-3-after-generated.jpg", "project-3-before-generated.jpg",
    "project-4-after-downspout-wide.jpg", "project-4-before-downspout-wide.jpg",
]:
    webp(source, source.replace(".jpg", ".webp"), quality=82)

logo = Image.open(IMAGES / "logo-site.png")
mark = logo.crop((0, 0, min(760, logo.width), logo.height))
canvas_size = max(mark.width, mark.height)
canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
canvas.alpha_composite(mark, ((canvas_size - mark.width) // 2, (canvas_size - mark.height) // 2))
canvas.resize((32, 32), Image.Resampling.LANCZOS).save(ROOT / "favicon.png", optimize=True)
canvas.resize((180, 180), Image.Resampling.LANCZOS).save(ROOT / "apple-touch-icon.png", optimize=True)

try:
    from fontTools.ttLib import TTFont
except ImportError:
    print("fontTools not installed; skipping WOFF2 font generation (pip install fonttools brotli).")
else:
    for ttf in sorted((ROOT / "assets" / "fonts").glob("montserrat-*.ttf")):
        font = TTFont(str(ttf))
        font.flavor = "woff2"
        font.save(str(ttf.with_suffix(".woff2")))

print("Optimized WebP assets and icons created.")
