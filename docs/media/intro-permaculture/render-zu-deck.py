#!/usr/bin/env python3
"""Post-process a Zulu deck rendered by make-lesson-slides.mjs for review."""
import argparse
import json
import tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

PAPER = (245, 240, 228)
GREEN = (31, 77, 43)
WHITE = (255, 255, 248)
INK = (32, 25, 15)
MUTED = (140, 122, 98)


def font(size, bold=False):
    candidates = (
        ['/System/Library/Fonts/Supplemental/Arial Bold.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf']
        if bold else
        ['/System/Library/Fonts/Supplemental/Arial.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']
    )
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


def wrap(draw, text, face, max_width):
    lines, current = [], ''
    for word in text.split():
        candidate = (current + ' ' + word).strip()
        if draw.textlength(candidate, font=face) <= max_width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def write_text(draw, xy, text, face, color, max_width, leading):
    x, y = xy
    for line in wrap(draw, text, face, max_width):
        draw.text((x, y), line, font=face, fill=color)
        y += leading


def draft_badge(draw, x, y, color=WHITE):
    draw.rounded_rectangle((x, y, 1868, y + 68), radius=15, fill=GREEN)
    draw.text((x + 14, y + 5), 'OKUSALUNGISWA NGE-AI', font=font(22, True), fill=color)
    draw.text((x + 14, y + 34), 'AKUKABUYEKEZWA', font=font(22, True), fill=color)


def scene_panel(draw, slide, width=1920):
    draw.rectangle((0, 820, width, 1080), fill=GREEN)
    write_text(draw, (72, 840), slide['title'], font(62, True), WHITE, 1776, 72)
    sentence = (slide.get('bullets') or [slide.get('caption', '')])[0]
    write_text(draw, (74, 919), sentence, font(43), WHITE, 1770, 54)
    draw.text((1390, 1036), 'OKUSALUNGISWA NGE-AI · AKUKABUYEKEZWA', font=font(24, True), fill=(236, 211, 151))


def intro_watch(draw, slide_num):
    if slide_num == 7:
        draw.rectangle((0, 0, 1920, 145), fill=PAPER)
        write_text(draw, (72, 25), 'Bheka: Isinqumo Esisodwa, Ama-Ethics Amathathu', font(50, True), GREEN, 940, 60)
        chips = [('Ukunakekela Umhlaba', (31, 113, 62)), ('Ukunakekela Abantu', (192, 90, 40)), ('Ukwabelana Ngokulinganayo', (42, 96, 164))]
        x = 910
        for label, color in chips:
            face = font(21, True)
            chip_width = int(draw.textlength(label, font=face)) + 44
            draw.rounded_rectangle((x, 49, x + chip_width, 98), radius=15, fill=color)
            draw.text((x + 22, 57), label, font=face, fill=WHITE)
            x += chip_width + 12
        labels = [
            ((125, 218, 445, 290), 'Umndeni', INK),
            ((570, 222, 850, 286), 'i-borehole', INK),
            ((1150, 222, 1500, 286), 'Omakhelwane', INK),
            ((880, 298, 1240, 375), 'Ukuqapha', GREEN),
            ((890, 595, 1160, 657), 'Izinga lamanzi', WHITE),
        ]
        for box, label, color in labels:
            x0, y0, _, _ = box
            draw.rectangle(box, fill=PAPER if label != 'Izinga lamanzi' else (153, 111, 88))
            draw.text((x0 + 8, y0 + 10), label, font=font(37, True), fill=color)
        draw.rectangle((68, 797, 1850, 1080), fill=(255, 255, 255), outline=(196, 186, 168), width=2)
        write_text(
            draw, (102, 826),
            'Qala uthole ukuthi ukwabelana ngamanzi kuvumelekile yini. Hlola ukuthi i-borehole ingakwazi yini ukusiza bonke abasebenzisi ngaphandle kokusebenzisa amanzi amaningi kakhulu.',
            font(40), INK, 1710, 53,
        )
        draw.text((1390, 1036), 'OKUSALUNGISWA NGE-AI · AKUKABUYEKEZWA', font=font(24, True), fill=MUTED)
    elif slide_num == 13:
        draw.rectangle((0, 0, 1920, 137), fill=PAPER)
        write_text(
            draw, (72, 23), 'Sebenzisa futhi wazise ukwehlukahlukana kwezinto eziphilayo.',
            font(46, True), GREEN, 1690, 60,
        )
        draw.rounded_rectangle((150, 232, 1770, 308), radius=22, fill=(79, 88, 98))
        hail = 'Isichotho'
        face = font(42, True)
        draw.text((960 - draw.textlength(hail, font=face) / 2, 248), hail, font=face, fill=WHITE)
        draw.rectangle((70, 310, 370, 370), fill=PAPER)
        draw.text((100, 319), 'Ummbila', font=font(38, True), fill=INK)
        draw.rectangle((975, 310, 1420, 370), fill=PAPER)
        draw.text((1000, 319), 'Ukutshala okuxubile', font=font(38, True), fill=INK)
        draw.rectangle((0, 780, 1920, 1080), fill=PAPER)
        write_text(
            draw, (76, 824),
            'Ukulimala kommbila yisichotho kuncike ekutheni isiphepho sinjani nokuthi ummbila ukhule kangakanani.',
            font(40, True), GREEN, 1760, 51,
        )
        draw.text((1390, 1036), 'OKUSALUNGISWA NGE-AI · AKUKABUYEKEZWA', font=font(24, True), fill=MUTED)
    elif slide_num == 19:
        draw.rounded_rectangle((200, 34, 1400, 125), radius=22, fill=GREEN)
        write_text(draw, (230, 42), slide_title(slide_num), font(43, True), WHITE, 1120, 52)
        draw.rectangle((0, 870, 1920, 1080), fill=GREEN)
        write_text(
            draw, (68, 890),
            'Umoya uvela enyakatho-ntshonalanga. Izihlahla nezihlahlana zimi phakathi kwalowo moya nezitshalo.',
            font(43, True), WHITE, 1775, 55,
        )
        draw.text((1390, 1036), 'OKUSALUNGISWA NGE-AI · AKUKABUYEKEZWA', font=font(24, True), fill=(236, 211, 151))


def intro_zones(image):
    """Use a localized, static derivative for slide 15; labels follow its narration."""
    art_path = Path('docs/media/intro-permaculture/zone-footpath-numbered-zu.png')
    if not art_path.exists():
        raise SystemExit(f'Missing localized zone still: {art_path}')
    art = Image.open(art_path).convert('RGB').resize((1920, 1080), Image.Resampling.LANCZOS)
    image.paste(art, (0, 0))
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, 1920, 150), fill=PAPER)
    write_text(draw, (72, 26), 'Ama-zone 0–5: Ukuhlela ngokuvakasha', font(58, True), GREEN, 1320, 66)
    draft_badge(draw, 1470, 35)
    draw.rectangle((0, 920, 1920, 1080), fill=GREEN)
    write_text(
        draw, (72, 952),
        'Ama-zone alandela ukuvakashela kwakho, hhayi izicingo.',
        font(58, True), WHITE, 1775, 66,
    )


CURRENT_SLIDE_TITLE = 'I-Windbreak Phakathi Komoya Nezitshalo'


def slide_title(slide_num):
    return CURRENT_SLIDE_TITLE if slide_num == 19 else ''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('module', help='course module id')
    parser.add_argument('--lang', default='zu')
    args = parser.parse_args()
    if args.lang != 'zu':
        raise SystemExit('This review renderer is for isiZulu decks only.')
    config = Path(tempfile.gettempdir()) / f'imbewu-slides-{args.module}-{args.lang}.json'
    cfg = json.loads(config.read_text())
    slide_map = {int(slide['n']): slide for slide in cfg['slides']}
    scene_slides = {
        int(number) for number, art in (cfg.get('artPlan') or {}).items()
        if art.get('layout') == 'scene'
    }
    source_dir = Path(cfg['outDir'])
    out_dir = Path.cwd() / 'public' / 'course-decks' / args.module / args.lang
    out_dir.mkdir(parents=True, exist_ok=True)
    rendered = 0
    for number, slide in sorted(slide_map.items()):
        path = source_dir / f'slide-{number:02}.png'
        image = Image.open(path).convert('RGB').resize((1920, 1080), Image.Resampling.LANCZOS)
        draw = ImageDraw.Draw(image)
        if number in scene_slides and not (args.module == 'intro-permaculture' and number in {7, 13, 19}):
            if args.module == 'intro-permaculture' and number in {4, 5, 6} and len(slide.get('bullets') or []) > 1:
                slide = {**slide, 'bullets': slide['bullets'][1:]}
            scene_panel(draw, slide)
        if args.module == 'intro-permaculture' and number in {7, 13, 19}:
            intro_watch(draw, number)
        elif args.module == 'intro-permaculture' and number == 15:
            intro_zones(image)
        else:
            draft_badge(draw, 1470, 35)
        image.save(out_dir / f'slide-{number:02}.jpg', 'JPEG', quality=88, optimize=True)
        rendered += 1
    print(f'Rendered {rendered} isiZulu review slides in {out_dir}')


if __name__ == '__main__':
    main()
