#!/usr/bin/env python3
"""Build the facilitator courses in courses/ into teachable outputs.

For every course folder that has a slides.md:
  * courses/build/<course>/<deck>.pptx   one PowerPoint per day, speaker notes = the short script
  * courses/build/<course>/<course>-phone-pack.html   every Markdown file of the course (plus the
    shared toolkit and forms) in one offline HTML page a facilitator can read on a phone
And once for all courses:
  * courses/media-manifest.json   every image / animation / poster artwork, with its brief, status
    (NEW for Codex, REUSE of an existing repo file) and the path Codex should write to

WHY ONE SOURCE: the day files, posters.md, slides.md and media.md are the course. Decks, phone
packs and the Codex manifest are derived from them, so a correction is made once in Markdown and
re-built, never patched in a .pptx by hand.

Media are placed on slides when the file exists (REUSE path, or public/course-media/<course>/<ID>.*
once Codex has made it); otherwise the slide carries a labelled placeholder with the brief, so a
deck is teachable today and fills itself in as art arrives. Clips are NOT embedded by default (a
day's clips would make a 60 MB deck); the slide shows the clip's still and names the file to play
from the tablet. Pass --embed-video to embed them.

Usage:
  pip install python-pptx markdown
  python3 scripts/courses/build.py                 # all courses
  python3 scripts/courses/build.py farmer-5day     # one course
  python3 scripts/courses/build.py --check         # validate references only, write nothing
"""
from __future__ import annotations

import argparse
import html
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
COURSES = ROOT / "courses"
BUILD = COURSES / "build"
PUBLIC = ROOT / "public"

PREFIX_TO_COURSE = {"F": "farmer-5day", "M": "mentor-3day", "T": "teach-the-teachers",
                    "R": "farmer-money", "A": "ai-literacy"}
COURSE_TITLES = {
    "farmer-5day": "Grow Food, Grow Strong",
    "mentor-3day": "Walking With Farmers",
    "teach-the-teachers": "Teach the Teachers",
    "farmer-money": "Farmer Money",
    "ai-literacy": "AI Literacy",
}

# ImbewuField palette (CLAUDE.md)
FOREST, MID, LEAF, OCHRE, WATER = "1F4D2B", "2E6B3A", "A8D88A", "C07A1E", "235E86"
PAPER, CARD, INK, HAIR = "F7F2E9", "FBF6EC", "20190F", "E2D8C4"
# Portable fonts: facilitator laptops won't have Newsreader / Public Sans installed.
HEAD_FONT, BODY_FONT = "Georgia", "Arial"

ID_RE = re.compile(r"\b([FMTRA])-(?:IMG|ANI|PHO)-\d+\b|\b([FMTRA])-P\d{2}-ART\b")
ANY_MEDIA_RE = re.compile(r"\b[FMTRA]-(?:IMG|ANI|PHO)-\d+\b|\b[FMTRA]-P\d{2}-ART\b")
POSTER_RE = re.compile(r"\b[FMTRA]-P\d{2}\b(?!-ART)")


# ── parsing ──────────────────────────────────────────────────────────────────────────────────

@dataclass
class Slide:
    id: str
    title: str
    type: str = "content"
    track: str = ""
    screen: list[str] = field(default_factory=list)
    media: list[str] = field(default_factory=list)
    posters: list[str] = field(default_factory=list)
    notes: str = ""


@dataclass
class Deck:
    id: str
    title: str
    slides: list[Slide] = field(default_factory=list)


def split_ids(value: str) -> list[str]:
    return [v.strip() for v in re.split(r"[,;]", value) if v.strip() and v.strip() not in ("—", "-")]


def parse_slides(path: Path) -> list[Deck]:
    decks: list[Deck] = []
    slide: Slide | None = None
    mode = None
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.rstrip()
        m = re.match(r"^# Deck (\S+)\s*[·—-]\s*(.+)$", line)
        if m:
            decks.append(Deck(m.group(1), m.group(2).strip()))
            slide, mode = None, None
            continue
        m = re.match(r"^## (\S+)\s*·\s*(.+)$", line)
        if m and decks:
            slide = Slide(m.group(1), m.group(2).strip())
            decks[-1].slides.append(slide)
            mode = None
            continue
        if slide is None:
            continue
        m = re.match(r"^(Type|Track|Media|Poster|Screen|Notes):\s*(.*)$", line)
        if m and mode != "notes":
            key, val = m.group(1), m.group(2).strip()
            if key == "Type":
                slide.type = val.lower()
            elif key == "Track":
                slide.track = val.lower()
            elif key == "Media":
                slide.media = split_ids(val)
            elif key == "Poster":
                slide.posters = split_ids(val)
            elif key == "Screen":
                mode = "screen"
            elif key == "Notes":
                mode = "notes"
                if val:
                    slide.notes += val + "\n"
            continue
        if mode == "screen" and line.startswith("- "):
            slide.screen.append(line[2:].strip())
        elif mode == "notes":
            slide.notes += line + "\n"
    for d in decks:
        for s in d.slides:
            s.notes = s.notes.strip()
    return decks


def parse_blocks(path: Path, header_re: str) -> list[dict]:
    """Parse `## <ID> · <title>` blocks with `- Key: value` lines and a free body."""
    if not path.exists():
        return []
    items: list[dict] = []
    cur: dict | None = None
    for line in path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^## (" + header_re + r")\s*·\s*(.+)$", line)
        if m:
            cur = {"id": m.group(1), "title": m.group(2).strip(), "fields": {}, "body": []}
            items.append(cur)
            continue
        if line.startswith("## ") or line.startswith("# "):
            cur = None
            continue
        if cur is None:
            continue
        m = re.match(r"^- ([A-Za-z ]+):\s*(.*)$", line)
        if m and not cur["body"]:
            cur["fields"][m.group(1).strip().lower()] = m.group(2).strip()
        else:
            cur["body"].append(line)
    for it in items:
        it["body"] = re.sub(r"\n-{3,}\s*$", "", "\n".join(it["body"]).strip()).strip()
    return items


def section(body: str, label: str) -> str:
    """Pull the text after a bold **Label…:** up to the next bold label."""
    m = re.search(r"\*\*" + re.escape(label) + r"[^*]*\*\*\s*(.*?)(?=\n\*\*[A-Z][^*]*:\*\*|\Z)", body, re.S)
    return m.group(1).strip() if m else ""


# ── media resolution ─────────────────────────────────────────────────────────────────────────

def course_of(media_id: str) -> str:
    return PREFIX_TO_COURSE[media_id[0]]


def target_path(media_id: str, typ: str) -> str:
    ext = "mp4" if typ == "animation" else "jpg"
    return f"public/course-media/{course_of(media_id)}/{media_id}.{ext}"


def build_catalog(course_dirs: list[Path]) -> dict[str, dict]:
    catalog: dict[str, dict] = {}
    for cdir in course_dirs:
        course = cdir.name
        for it in parse_blocks(cdir / "media.md", r"[FMTRA]-(?:IMG|ANI|PHO)-\d+"):
            f = it["fields"]
            typ = f.get("type", "image").lower()
            status = f.get("status", "NEW")
            reuse = status.split(None, 1)[1].strip() if status.upper().startswith("REUSE") and " " in status else ""
            brief = re.sub(r"^\*\*Brief:\*\*\s*", "", it["body"]).strip()
            catalog[it["id"]] = {
                "id": it["id"], "course": course, "kind": typ, "title": it["title"],
                "status": "REUSE" if reuse else "NEW", "reuse_path": reuse or None,
                "target": None if reuse else target_path(it["id"], typ),
                "used_in": split_ids(f.get("used in", "")), "length": f.get("length", ""),
                "brief": brief,
            }
        for it in parse_blocks(cdir / "posters.md", r"[FMTRA]-P\d{2}"):
            f = it["fields"]
            art_id = f.get("art") or f"{it['id']}-ART"
            poster = {
                "id": it["id"], "course": course, "kind": "poster", "title": it["title"],
                "size": f.get("size", "A1 portrait"), "used_in": split_ids(f.get("used in", "")),
                "art": art_id, "headline": section(it["body"], "Headline"),
                "labels": section(it["body"], "Labels"), "layout": section(it["body"], "Layout"),
                "teach_it": section(it["body"], "Teach it"), "status": "NEW",
                "target": f"public/course-media/{course}/posters/{it['id']}.pdf",
                "phone_target": f"public/course-media/{course}/posters/{it['id']}.jpg",
            }
            catalog[it["id"]] = poster
            catalog[art_id] = {
                "id": art_id, "course": course, "kind": "poster-art", "title": f"Artwork for {it['id']} · {it['title']}",
                "status": "NEW", "reuse_path": None, "target": target_path(art_id, "image"),
                "used_in": [it["id"]] + poster["used_in"], "length": "still",
                "brief": section(it["body"], "Art brief"),
            }
    return catalog


def existing_file(item: dict) -> Path | None:
    for rel in (item.get("reuse_path"), item.get("target")):
        if rel:
            p = ROOT / rel
            if p.exists():
                return p
    return None


def still_for(item: dict) -> Path | None:
    """An image to put on the slide: the image itself, or a clip's poster frame."""
    f = existing_file(item)
    if f is None:
        return None
    if f.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp"):
        return f if f.suffix.lower() != ".webp" else None
    if f.suffix.lower() == ".mp4":
        for cand in (f.parent / "posters" / (f.stem + ".jpg"), f.with_suffix(".jpg")):
            if cand.exists():
                return cand
    return None


# ── per-course look (courses/<course>/style.md) ──────────────────────────────────────────────

def _code_after(md: str, heading: str) -> str:
    m = re.search(r"^##\s+" + re.escape(heading) + r".*?\n```[a-z]*\n(.*?)\n```", md, re.S | re.M)
    return m.group(1).strip() if m else ""


def load_style(course: str) -> dict:
    """Deck theme + generator anchors for a course. Falls back to the ImbewuField palette."""
    p = COURSES / course / "style.md"
    md = p.read_text(encoding="utf-8") if p.exists() else ""
    theme = {"bg": PAPER, "ink": INK, "accent": OCHRE, "accent2": WATER, "section_bg": FOREST,
             "section_ink": PAPER, "fallback_head": HEAD_FONT, "fallback_body": BODY_FONT}
    raw = _code_after(md, "Deck theme")
    if raw:
        theme.update(json.loads(raw))
    title = re.search(r"^# .*?[—-]\s*\"?(.+?)\"?\s*$", md, re.M)
    return {"theme": theme, "look": title.group(1) if title else "",
            "image_anchor": _code_after(md, "Image anchor"),
            "poster_anchor": _code_after(md, "Poster anchor"),
            "animation_anchor": _code_after(md, "Animation anchor")}


def load_i18n(course: str, lang: str) -> dict:
    p = COURSES / course / "i18n" / f"{lang}.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}


# ── validation ───────────────────────────────────────────────────────────────────────────────

def validate(course_dirs: list[Path], catalog: dict) -> list[str]:
    problems: list[str] = []
    for cdir in course_dirs:
        decks = parse_slides(cdir / "slides.md") if (cdir / "slides.md").exists() else []
        if not decks:
            problems.append(f"{cdir.name}: no decks in slides.md")
        seen: set[str] = set()
        for d in decks:
            for s in d.slides:
                if s.id in seen:
                    problems.append(f"{cdir.name}: duplicate slide id {s.id}")
                seen.add(s.id)
                if len(s.screen) > 3:
                    problems.append(f"{s.id}: {len(s.screen)} screen bullets (max 3)")
                for mid in s.media:
                    if mid not in catalog:
                        problems.append(f"{s.id}: media {mid} is not defined in any media.md / posters.md")
                for pid in s.posters:
                    if pid not in catalog:
                        problems.append(f"{s.id}: poster {pid} is not defined in any posters.md")
        # IDs mentioned anywhere in the course's Markdown must resolve too
        for md in sorted(cdir.glob("*.md")):
            text = md.read_text(encoding="utf-8")
            for mid in set(ANY_MEDIA_RE.findall(text)):
                if mid not in catalog:
                    problems.append(f"{cdir.name}/{md.name}: mentions {mid}, which is not defined")
            for pid in set(POSTER_RE.findall(text)):
                if pid not in catalog:
                    problems.append(f"{cdir.name}/{md.name}: mentions poster {pid}, which is not defined")
        for it in catalog.values():
            if it["course"] == cdir.name and it.get("reuse_path") and not (ROOT / it["reuse_path"]).exists():
                problems.append(f"{it['id']}: REUSE path does not exist: {it['reuse_path']}")
    return problems


# ── PowerPoint ───────────────────────────────────────────────────────────────────────────────

def build_deck(course: str, deck: Deck, catalog: dict, out: Path, embed_video: bool, lang: str = "en") -> None:
    from pptx import Presentation
    from pptx.dml.color import RGBColor
    from pptx.enum.shapes import MSO_SHAPE
    from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
    from pptx.util import Emu, Pt

    def rgb(h: str) -> RGBColor:
        return RGBColor.from_string(h)

    style = load_style(course)
    T = style["theme"]
    # Shadow the house palette with this course's own look (see style.md).
    PAPER, INK, OCHRE, WATER = T["bg"], T["ink"], T["accent"], T["accent2"]
    SEC_BG, SEC_INK, HEADC = T["section_bg"], T["section_ink"], T["ink"]
    CARD, HAIR, LEAF = T.get("card", T["bg"]), T.get("rule", T["accent2"]), T["section_ink"]
    HEAD_FONT, BODY_FONT = T["fallback_head"], T["fallback_body"]
    tr = (load_i18n(course, lang).get("slides") or {}) if lang != "en" else {}

    prs = Presentation()
    prs.slide_width, prs.slide_height = Emu(12192000), Emu(6858000)  # 16:9, 13.333 × 7.5 in
    W, H = prs.slide_width, prs.slide_height
    blank = prs.slide_layouts[6]
    IN = 914400

    def box(slide, x, y, w, h, fill=None, line=None, shape=MSO_SHAPE.RECTANGLE):
        s = slide.shapes.add_shape(shape, Emu(int(x)), Emu(int(y)), Emu(int(w)), Emu(int(h)))
        if fill:
            s.fill.solid(); s.fill.fore_color.rgb = rgb(fill)
        else:
            s.fill.background()
        if line:
            s.line.color.rgb = rgb(line); s.line.width = Pt(1.25)
        else:
            s.line.fill.background()
        s.shadow.inherit = False
        return s

    def text(slide, x, y, w, h, runs, size=24, color=INK, font=BODY_FONT, bold=False,
             align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP, bullets=False, spacing=8):
        tb = slide.shapes.add_textbox(Emu(int(x)), Emu(int(y)), Emu(int(w)), Emu(int(h)))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.vertical_anchor = anchor
        tf.margin_left = tf.margin_right = Emu(int(0.05 * IN))
        for i, r in enumerate(runs if isinstance(runs, list) else [runs]):
            p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
            p.alignment = align
            p.space_after = Pt(spacing)
            run = p.add_run()
            run.text = ("•  " + r) if bullets else r
            run.font.size = Pt(size); run.font.bold = bold; run.font.name = font
            run.font.color.rgb = rgb(color)
        return tb

    def place_media(slide, mid: str, x, y, w, h):
        item = catalog.get(mid)
        if item is None:
            return
        f = existing_file(item)
        if embed_video and f is not None and f.suffix.lower() == ".mp4":
            poster = still_for(item)
            slide.shapes.add_movie(str(f), Emu(int(x)), Emu(int(y)), Emu(int(w)), Emu(int(h)),
                                   poster_frame_image=str(poster) if poster else None, mime_type="video/mp4")
            return
        still = still_for(item)
        if still is not None:
            from PIL import Image
            with Image.open(still) as im:
                iw, ih = im.size
            scale = min(w / iw, h / ih)
            pw, ph = iw * scale, ih * scale
            slide.shapes.add_picture(str(still), Emu(int(x + (w - pw) / 2)), Emu(int(y + (h - ph) / 2)),
                                     Emu(int(pw)), Emu(int(ph)))
            if item["kind"] == "animation":
                rel = (item.get("reuse_path") or item.get("target") or "")
                tag = box(slide, x, y + h - 0.45 * IN, w, 0.45 * IN, fill=INK)
                tag.fill.transparency = 0.2
                text(slide, x + 0.1 * IN, y + h - 0.44 * IN, w - 0.2 * IN, 0.42 * IN,
                     f"▶  Clip {mid} · play from the tablet: {Path(rel).name}", size=11, color=PAPER,
                     anchor=MSO_ANCHOR.MIDDLE)
            return
        # Placeholder: teachable today, replaced automatically when the art lands.
        box(slide, x, y, w, h, fill=CARD, line=HAIR)
        kind = {"animation": "ANIMATION", "poster-art": "POSTER ART", "photo": "PHOTO"}.get(item["kind"], "IMAGE")
        text(slide, x + 0.25 * IN, y + 0.2 * IN, w - 0.5 * IN, 0.4 * IN, f"{kind} · {mid} · coming",
             size=12, color=OCHRE, bold=True)
        text(slide, x + 0.25 * IN, y + 0.62 * IN, w - 0.5 * IN, 0.5 * IN, item["title"], size=18,
             color=HEADC, font=HEAD_FONT, bold=True)
        brief = re.sub(r"\s+", " ", item.get("brief") or "")
        if len(brief) > 360:
            brief = brief[:357].rsplit(" ", 1)[0] + "…"
        text(slide, x + 0.25 * IN, y + 1.2 * IN, w - 0.5 * IN, h - 1.4 * IN, brief, size=11, color=INK)

    for s in deck.slides:
        t = tr.get(s.id) or {}
        title = t.get("title") or s.title
        screen = t.get("screen") if t.get("screen") and len(t["screen"]) == len(s.screen) else s.screen
        slide = prs.slides.add_slide(blank)
        bg = slide.background.fill
        bg.solid(); bg.fore_color.rgb = rgb(SEC_BG if s.type == "section" else PAPER)

        # footer: slide id + poster to switch to
        foot = f"{s.id}" + (f"   ·   Poster {', '.join(s.posters)}" if s.posters else "")
        text(slide, 0.5 * IN, H - 0.45 * IN, 8 * IN, 0.35 * IN, foot, size=10,
             color=LEAF if s.type == "section" else INK)
        text(slide, W - 4.5 * IN, H - 0.45 * IN, 4 * IN, 0.35 * IN, COURSE_TITLES.get(course, course),
             size=10, color=LEAF if s.type == "section" else INK, align=PP_ALIGN.RIGHT)
        if s.track == "app":
            b = box(slide, W - 1.6 * IN, 0.3 * IN, 1.1 * IN, 0.4 * IN, fill=WATER, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
            text(slide, W - 1.6 * IN, 0.3 * IN, 1.1 * IN, 0.4 * IN, "APP", size=12, color=PAPER, bold=True,
                 align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)

        if s.type == "section":
            text(slide, 0.9 * IN, 1.6 * IN, 7 * IN, 1.8 * IN, title, size=48, color=SEC_INK, font=HEAD_FONT,
                 bold=True, anchor=MSO_ANCHOR.BOTTOM)
            box(slide, 0.9 * IN, 3.55 * IN, 1.6 * IN, 0.08 * IN, fill=OCHRE)
            text(slide, 0.9 * IN, 3.8 * IN, 6.6 * IN, 2 * IN, screen, size=24, color=LEAF)
            if s.media:
                place_media(slide, s.media[0], 8.2 * IN, 1.0 * IN, 4.6 * IN, 5.2 * IN)
        else:
            if s.type == "activity":
                b = box(slide, 0.5 * IN, 0.35 * IN, 1.9 * IN, 0.45 * IN, fill=OCHRE, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
                text(slide, 0.5 * IN, 0.35 * IN, 1.9 * IN, 0.45 * IN, ("SEBENZANI" if lang == "zu" else "YOUR TURN"), size=14, color=PAPER, bold=True,
                     align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
                ty = 0.9 * IN
            else:
                ty = 0.45 * IN
            text(slide, 0.5 * IN, ty, 12.3 * IN, 1.1 * IN, title, size=38, color=HEADC, font=HEAD_FONT, bold=True)
            box(slide, 0.5 * IN, ty + 1.15 * IN, 12.3 * IN, Emu(9525), fill=HAIR)
            has_media = bool(s.media)
            s_screen = screen
            tw = 5.6 * IN if has_media else 12.3 * IN
            size = 30 if s.type == "activity" else 28
            if has_media and max((len(b) for b in screen), default=0) > 30:
                size -= 4  # half-width column: keep long bullets to two lines
            text(slide, 0.5 * IN, ty + 1.45 * IN, tw, H - ty - 2.3 * IN, s_screen, size=size, color=INK,
                 bold=(s.type == "activity"), bullets=True, spacing=16)
            if has_media:
                place_media(slide, s.media[0], 6.4 * IN, ty + 1.4 * IN, 6.4 * IN, H - ty - 2.1 * IN)

        notes = s.notes
        extra = []
        if s.posters:
            extra.append("Poster: " + ", ".join(s.posters))
        if len(s.media) > 1:
            extra.append("Also: " + ", ".join(s.media[1:]))
        clips = [m for m in s.media if catalog.get(m, {}).get("kind") == "animation"]
        for c in clips:
            it = catalog[c]
            extra.append(f"Clip {c}: {it.get('reuse_path') or it.get('target')}")
        slide.notes_slide.notes_text_frame.text = (notes + ("\n\n" + "\n".join(extra) if extra else "")).strip()

    out.parent.mkdir(parents=True, exist_ok=True)
    prs.save(str(out))


# ── phone pack ───────────────────────────────────────────────────────────────────────────────

PACK_CSS = """
:root{--forest:#1F4D2B;--mid:#2E6B3A;--leaf:#A8D88A;--ochre:#C07A1E;--water:#235E86;--paper:#F7F2E9;
--card:#FBF6EC;--ink:#20190F;--hair:#E2D8C4;--muted:#5b5446}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--paper:#15140f;--card:#1d1b15;--ink:#efe8da;
--hair:#39342a;--muted:#b5ab98;--forest:#A8D88A;--mid:#8fc775}}
:root[data-theme="dark"]{--paper:#15140f;--card:#1d1b15;--ink:#efe8da;--hair:#39342a;--muted:#b5ab98;--forest:#A8D88A;--mid:#8fc775}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--paper);color:var(--ink);font:17px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}
header{position:sticky;top:0;z-index:5;background:var(--forest);color:#F7F2E9;padding:10px 16px;display:flex;gap:10px;align-items:center}
header b{font-family:Georgia,serif;font-size:17px;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
header select{max-width:52vw;font-size:15px;padding:6px;border-radius:6px;border:0;background:#F7F2E9;color:#20190F}
main{max-width:760px;margin:0 auto;padding:8px 16px 80px}
section.doc{border-bottom:3px solid var(--hair);padding-bottom:24px;margin-bottom:24px}
h1,h2,h3{font-family:Georgia,"Times New Roman",serif;line-height:1.2;color:var(--forest)}
h1{font-size:1.7rem;margin:24px 0 8px}h2{font-size:1.3rem;margin:28px 0 8px;padding-top:12px;border-top:1px solid var(--hair)}
h3{font-size:1.05rem;margin:20px 0 6px;color:var(--ochre)}
table{border-collapse:collapse;width:100%;font-size:14.5px;margin:10px 0;display:block;overflow-x:auto}
th,td{border:1px solid var(--hair);padding:6px 8px;text-align:left;vertical-align:top}
th{background:var(--card)}
code,pre{font-family:ui-monospace,Menlo,monospace;font-size:13.5px;background:var(--card);border-radius:4px}
pre{padding:10px;overflow-x:auto}
blockquote{margin:12px 0;padding:6px 14px;border-left:4px solid var(--ochre);background:var(--card)}
a{color:var(--water)}strong{color:inherit}
li{margin:3px 0}
.meta{color:var(--muted);font-size:13px}
"""


def md_to_html(text: str) -> str:
    import markdown
    return markdown.markdown(text, extensions=["tables", "fenced_code", "sane_lists"])


def build_pack(cdir: Path, out: Path) -> None:
    order = ["README.md", "day-0-preparation.md"] + sorted(p.name for p in cdir.glob("day-*.md")
                                                              if p.name != "day-0-preparation.md")
    rest = sorted(p.name for p in cdir.glob("*.md") if p.name not in order)
    # put the parsed technical files last; they are for producers more than facilitators
    tail = [n for n in ("slides.md", "media.md") if n in rest]
    rest = [n for n in rest if n not in tail] + tail
    docs = [(n, cdir / n) for n in order + rest if (cdir / n).exists()]
    docs += [(f"shared/{n}", COURSES / "shared" / n) for n in ("facilitation-toolkit.md", "forms.md", "poster-standards.md")]
    title = COURSE_TITLES.get(cdir.name, cdir.name)
    opts, bodies = [], []
    for i, (name, path) in enumerate(docs):
        anchor = f"doc{i}"
        src = path.read_text(encoding="utf-8")
        first = next((l[2:].strip() for l in src.splitlines() if l.startswith("# ")), name)
        opts.append(f'<option value="#{anchor}">{html.escape(first)}</option>')
        bodies.append(f'<section class="doc" id="{anchor}"><p class="meta">{html.escape(name)}</p>{md_to_html(src)}</section>')
    page = f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(title)} — facilitator pack</title><style>{PACK_CSS}</style></head><body>
<header><b>{html.escape(title)}</b><select aria-label="Jump to" onchange="location.hash=this.value">{''.join(opts)}</select></header>
<main>{''.join(bodies)}</main></body></html>"""
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page, encoding="utf-8")


# ── generation prompts (for Gemini/Imagen, Veo, Google Flow, ChatGPT) ────────────────────────

FORMATS = {
    "image": "Landscape 16:9 composition.",
    "poster-art": "Portrait 3:4 composition for an A1 teaching poster; keep the top 15% and bottom 20% "
                  "calm and uncluttered (text is added there later).",
    "photo": "Landscape 16:9.",
    "animation": "16:9, 8-second shot, silent.",
}


def attach_prompts(catalog: dict) -> None:
    styles: dict[str, dict] = {}
    for it in catalog.values():
        if it["kind"] == "poster" or it.get("status") != "NEW":
            continue
        st = styles.setdefault(it["course"], load_style(it["course"]))
        anchor = st["animation_anchor"] if it["kind"] == "animation" else st["image_anchor"]
        fmt = FORMATS.get(it["kind"], "")
        if it["kind"] == "image" and "card" in (it.get("length") or ""):
            fmt = "Portrait 2:3 card composition, one subject centred, plain background."
        brief = re.sub(r"\s+", " ", it.get("brief") or it["title"]).strip()
        it["prompt"] = f"{anchor}\n\n{fmt}\n\nSubject: {brief}".strip()
        if it["kind"] == "animation":
            secs = re.search(r"(\d+)\s*s", it.get("length") or "")
            n = max(1, -(-int(secs.group(1)) // 8)) if secs else 1
            it["shots"] = n


def attach_translations(catalog: dict, course_dirs: list[Path]) -> None:
    for cdir in course_dirs:
        zu = load_i18n(cdir.name, "zu").get("posters") or {}
        for pid, text in zu.items():
            if pid in catalog:
                catalog[pid]["zu"] = text


def write_prompt_packs(course: str, catalog: dict, out_dir: Path) -> None:
    st = load_style(course)
    items = [it for it in catalog.values() if it["course"] == course and it.get("prompt")]
    imgs = [it for it in items if it["kind"] != "animation"]
    anis = [it for it in items if it["kind"] == "animation"]
    head = (f"# {COURSE_TITLES.get(course, course)} — %s prompts ({st['look']})\n\n"
            "Generated by scripts/courses/build.py. Paste each block as-is. Save the result at the path shown, "
            "then re-run the build — the decks pick it up.\n\n")
    lines = [head % "image"]
    lines.append("Tips for ChatGPT / Gemini: keep one chat per course so the look stays consistent; generate the "
                 "character sheet first and attach it as a reference to later prompts.\n\n")
    for it in sorted(imgs, key=lambda i: i["id"]):
        lines.append(f"## {it['id']} · {it['title']}\nSave as: `{it['target']}`  ·  used in: {', '.join(it['used_in'])}\n\n```\n{it['prompt']}\n```\n\n")
    (out_dir / "prompts-images.md").write_text("".join(lines), encoding="utf-8")
    lines = [head % "animation"]
    lines.append("Google Flow makes ~8-second shots. Items marked with more than one shot: make shot 1 from the "
                 "prompt, then use Scenebuilder → Extend (or Frames to Video from the last frame) for the rest, "
                 "describing the next step of the Subject. Export MP4 720p, mute the audio track, and save a "
                 "still frame as .jpg with the same name.\n\n")
    for it in sorted(anis, key=lambda i: i["id"]):
        lines.append(f"## {it['id']} · {it['title']}\nSave as: `{it['target']}` (+ `.jpg` still)  ·  shots: {it.get('shots', 1)}  ·  "
                     f"length: {it.get('length', '')}\n\n```\n{it['prompt']}\n```\n\n")
    (out_dir / "prompts-animations.md").write_text("".join(lines), encoding="utf-8")


def _labels(text: str) -> list[str]:
    out = []
    for line in (text or "").splitlines():
        m = re.match(r"^\s*\d+[.)]\s*(.+)$", line)
        if m:
            out.append(m.group(1).strip())
    return out


def _question(layout: str) -> str:
    m = re.search(r"[Qq]uestion strip:\s*\*?\"?([^\"*]+?)\"?\*?(?:\.|$)", layout or "")
    return m.group(1).strip() if m else ""


def write_poster_prompts(course: str, catalog: dict, out_dir: Path) -> None:
    """Full-poster prompts (art + isiZulu/English lettering) for ChatGPT's image mode."""
    st = load_style(course)
    posters = sorted((it for it in catalog.values() if it["course"] == course and it["kind"] == "poster"),
                     key=lambda i: i["id"])
    lines = [f"# {COURSE_TITLES.get(course, course)} — poster prompts, isiZulu + English ({st['look']})\n\n",
             "Generated by scripts/courses/build.py. One block = one finished poster. Paste into ChatGPT "
             "(image mode), one chat per course, portrait. Then CHECK EVERY WORD against the block — image "
             "models misspell, especially isiZulu. If a word is wrong, reply in the same chat: "
             "'Keep everything the same, only correct the spelling of <wrong> to <right>.' "
             "Save the result as the phone JPG path shown; for print, upscale to A1 or rebuild the "
             "lettering in a layout tool from the same words. isiZulu is a DRAFT until read back by a "
             "first-language speaker.\n\n"]
    for it in posters:
        en_labels = _labels(it.get("labels"))
        zu = it.get("zu") or {}
        zu_labels = zu.get("labels") or []
        en_q = _question(it.get("layout"))
        art = catalog.get(it.get("art"), {}).get("brief", "")
        text = [f'- Small top corner: "{it["id"]}"',
                f'- HEADLINE in isiZulu (largest words on the poster): "{zu.get("headline") or it["headline"]}"',
                f'- Directly under it, smaller (about 60%), in English: "{it["headline"]}"']
        if en_labels:
            text.append("- Numbered labels. Each label: isiZulu in bold, English underneath in smaller regular type:")
            for n, en in enumerate(en_labels):
                zl = zu_labels[n] if n < len(zu_labels) else ""
                text.append(f'  {n + 1}. "{zl}" / "{en}"' if zl else f'  {n + 1}. "{en}"')
        q = zu.get("question") or ""
        if q or en_q:
            text.append(f'- Bottom strip, italic: "{q or en_q}"' + (f' (English, smaller: "{en_q}")' if q and en_q else ""))
        layout = " ".join((it.get("layout") or "").split())
        art_flat = " ".join(art.split())
        prompt = (st["poster_anchor"] + "\n\nPortrait 3:4 (A1 poster). Layout: " + layout + "\n\n"
                  + "PICTURE: " + art_flat + "\n\n"
                  + "TEXT - use exactly these words, spelled exactly as written, and no other words, letters, "
                  + "numbers or watermarks anywhere:\n" + "\n".join(text) + "\n\n"
                  + "Text must be large, high-contrast and readable from 6 metres; keep it inside the margins; "
                  + "the poster must still read when photocopied in black and white. SOUTHERN HEMISPHERE: sun in "
                  + "the north, shadows fall south. People are Black South Africans of mixed ages and genders.")
        lines.append(f"## {it['id']} · {it['title']}\nSave as: `{it['phone_target']}`  ·  size: {it.get('size')}  ·  "
                     f"used in: {', '.join(it['used_in'])}\n\n```\n{prompt}\n```\n\n")
    (out_dir / "prompts-posters.md").write_text("".join(lines), encoding="utf-8")


# ── main ─────────────────────────────────────────────────────────────────────────────────────

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("courses", nargs="*", help="course folder names (default: all)")
    ap.add_argument("--check", action="store_true", help="validate only")
    ap.add_argument("--embed-video", action="store_true", help="embed clips in the .pptx (large files)")
    args = ap.parse_args()

    all_dirs = sorted(p for p in COURSES.iterdir() if p.is_dir() and (p / "slides.md").exists())
    wanted = [d for d in all_dirs if not args.courses or d.name in args.courses]
    if args.courses and len(wanted) != len(args.courses):
        print("Unknown course:", set(args.courses) - {d.name for d in wanted}, file=sys.stderr)
        return 2

    catalog = build_catalog(all_dirs)
    attach_prompts(catalog)
    attach_translations(catalog, all_dirs)
    problems = validate(wanted, catalog)
    for p in problems:
        print("WARN", p)
    if args.check:
        print(f"{len(problems)} problem(s) in {len(wanted)} course(s)")
        return 1 if problems else 0

    manifest = {
        "about": "Generated by scripts/courses/build.py from courses/*/media.md and posters.md. Do not edit by hand.",
        "rules": "courses/shared/poster-standards.md (Art rules) and courses/shared/PRODUCTION-GUIDE.md",
        "items": sorted(catalog.values(), key=lambda it: (it["course"], it["kind"], it["id"])),
    }
    (COURSES / "media-manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    for cdir in wanted:
        decks = parse_slides(cdir / "slides.md")
        langs = ["en"] + [l for l in ("zu",) if (cdir / "i18n" / f"{l}.json").exists()]
        for d in decks:
            for lang in langs:
                name = f"{d.id}.pptx" if lang == "en" else f"{d.id}.{lang}.pptx"
                build_deck(cdir.name, d, catalog, BUILD / cdir.name / name, args.embed_video, lang)
        write_prompt_packs(cdir.name, catalog, BUILD / cdir.name)
        write_poster_prompts(cdir.name, catalog, BUILD / cdir.name)
        build_pack(cdir, BUILD / cdir.name / f"{cdir.name}-phone-pack.html")
        n_new = sum(1 for it in catalog.values() if it["course"] == cdir.name and it["status"] == "NEW" and it["kind"] != "poster")
        n_reuse = sum(1 for it in catalog.values() if it["course"] == cdir.name and it["status"] == "REUSE")
        print(f"{cdir.name} [{'+'.join(langs)}]: {len(decks)} decks, {sum(len(d.slides) for d in decks)} slides; media NEW {n_new} / REUSE {n_reuse}")
    print(f"manifest: {len(catalog)} items → courses/media-manifest.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
