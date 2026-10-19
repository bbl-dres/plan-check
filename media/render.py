"""Render the explainer film (how-it-works.html) to WebM, one file per language, with a poster frame each:

    python media/render.py                 # de, fr, it, en -> how-it-works-<lang>.webm and -<lang>.jpg
    python media/render.py --lang de       # one language
    python media/render.py --fps 24        # fewer frames (30 by default)
    python media/render.py --texts         # only copy the interface texts from locales/*.json into the film

The film shows the app's own words: before rendering, every quoted locale key of how-it-works.html is copied from
locales/<lang>.json into the block between its APP markers. The film is a pure function of time (window.seek), so
every frame is exact: a headless Chromium (Playwright) is asked for frame after frame as a PNG and ffmpeg (the
imageio-ffmpeg wheel's binary) encodes them as VP9. After plan-extract's app/media/render.py. Needs
    pip install playwright imageio-ffmpeg && python -m playwright install chromium
About a minute per language; the film's font comes from Google Fonts, so the machine needs the internet.
"""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCE = HERE / "how-it-works.html"
LOCALES = HERE.parent / "locales"
LANGS = ("de", "fr", "it", "en")
POSTER_AT = 19.4                                           # seconds: the errors on the plan, the affected rooms red
WIDTH, HEIGHT = 1280, 720
BLOCK = re.compile(r"(// APP:begin\n)(.*?)(// APP:end)", re.S)


def sync_texts():
    """Copy the interface texts the film uses from the locale files into its APP block."""
    html = SOURCE.read_text(encoding="utf-8")
    locales = {lang: json.loads((LOCALES / f"{lang}.json").read_text(encoding="utf-8")) for lang in LANGS}
    used = sorted({k for k in re.findall(r"'([a-zA-Z]+\.[A-Za-z0-9_]+)'", BLOCK.sub("", html)) if k in locales["de"]})
    missing = [f"{lang}:{k}" for lang in LANGS for k in used if k not in locales[lang]]
    if missing:
        sys.exit("keys missing in the locale files: " + ", ".join(missing))
    lines = ["const APP = {"]
    for lang in LANGS:
        lines.append(f"  {lang}: {{")
        lines += [f"    {json.dumps(k)}: {json.dumps(locales[lang][k], ensure_ascii=False)}," for k in used]
        lines.append("  },")
    lines.append("};")
    new = BLOCK.sub(lambda m: m.group(1) + "\n".join(lines) + "\n" + m.group(3), html, count=1)
    if new != html:
        SOURCE.write_text(new, encoding="utf-8", newline="\n")
    print(f"texts: {len(used)} keys from locales/*.json")


def ffmpeg_exe():
    try:
        import imageio_ffmpeg
    except ImportError:
        sys.exit("imageio-ffmpeg is not installed: pip install imageio-ffmpeg")
    return imageio_ffmpeg.get_ffmpeg_exe()


def render(lang, fps, crf):
    from playwright.sync_api import sync_playwright

    out = HERE / f"how-it-works-{lang}.webm"
    poster = HERE / f"how-it-works-{lang}.jpg"
    ffmpeg = ffmpeg_exe()
    cmd = [ffmpeg, "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(fps), "-c:v", "png", "-i", "-",
           "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", str(crf), "-pix_fmt", "yuv420p", "-row-mt", "1", "-deadline", "good",
           "-cpu-used", "2", "-g", str(fps * 2), "-an", str(out)]
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_context(viewport={"width": WIDTH, "height": HEIGHT}, device_scale_factor=1).new_page()
        page.goto(SOURCE.as_uri() + f"?lang={lang}&nocontrols&paused")
        page.evaluate("document.fonts.ready.then(() => true)")
        total = page.evaluate("window.film.total")
        frames = round(total * fps)
        enc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
        poster_png = None
        for i in range(frames):
            t = i / fps
            page.evaluate(f"window.seek({t})")
            png = page.screenshot(type="png")
            enc.stdin.write(png)
            if poster_png is None and t >= POSTER_AT:
                poster_png = png
            if i % (fps * 5) == 0:
                print(f"{lang}: {t:5.1f} / {total:.0f} s", flush=True)
        enc.stdin.close()
        if enc.wait() != 0:
            sys.exit(f"ffmpeg failed for {lang}")
        browser.close()
    subprocess.run([ffmpeg, "-y", "-loglevel", "error", "-f", "image2pipe", "-c:v", "png", "-i", "-", "-frames:v", "1", "-q:v", "4", str(poster)],
                   input=poster_png, check=True)
    print(f"{lang}: {out.name} {out.stat().st_size / 1e6:.2f} MB, {poster.name} {poster.stat().st_size / 1e3:.0f} kB")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--lang", default=",".join(LANGS), help="languages, comma-separated (default: all four)")
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--crf", type=int, default=32, help="VP9 quality, lower is better and larger (default 32)")
    ap.add_argument("--texts", action="store_true", help="only copy the interface texts into the film, render nothing")
    a = ap.parse_args()
    sync_texts()
    if a.texts:
        return
    for lang in a.lang.split(","):
        if lang not in LANGS:
            sys.exit(f"unknown language {lang!r}: {', '.join(LANGS)}")
        render(lang, a.fps, a.crf)


if __name__ == "__main__":
    main()
