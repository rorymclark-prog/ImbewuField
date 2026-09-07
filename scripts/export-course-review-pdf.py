#!/usr/bin/env python3
"""Portable slide review: illustrated front, then every reading continuation."""
from pathlib import Path
from io import BytesIO
import re
import sys
import cairosvg
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

ROOT=Path(__file__).resolve().parents[1]
TITLES={'intro-permaculture':'Introduction to Permaculture','soil-health':'Soil Health'}

def export(module, destination):
    folder=ROOT/'public/course-decks'/module/'en'
    source=(ROOT/'docs/narration'/f'{module}.en.md').read_text()
    tracks=re.findall(r'\*\*Slide (\d+) — (.*?)\*\*',source)
    writer=PdfWriter()
    writer.add_metadata({'/Title':f'Imbewu - {TITLES.get(module,module)} - Draft slide review',
                         '/Author':'Imbewu Yoshintso',
                         '/Subject':'Illustrated slides and complete reading cards; animations and narration are separate.'})
    page_count=0
    for n,title in tracks:
        stem=f'slide-{int(n):02d}'
        front=folder/f'{stem}-front.jpg'
        if not front.exists() and int(n)==1:front=folder/'cover.jpg'
        readings=[folder/f'{stem}.svg']
        continuations=list(folder.glob(f'{stem}-continuation*.svg'))
        continuations.sort(key=lambda p:1 if p.stem.endswith('continuation') else int(p.stem.rsplit('-',1)[1]))
        readings+=continuations
        files=([front] if front.exists() else [])+readings
        bookmark=page_count
        for path in files:
            if path.suffix=='.svg':
                document=cairosvg.svg2pdf(url=str(path))
            else:
                output=BytesIO()
                sheet=canvas.Canvas(output,pagesize=(960,540),pageCompression=1)
                sheet.drawImage(ImageReader(str(path)),0,0,width=960,height=540)
                sheet.showPage();sheet.save();document=output.getvalue()
            reader=PdfReader(BytesIO(document))
            assert len(reader.pages)==1,path
            writer.add_page(reader.pages[0]);page_count+=1
        writer.add_outline_item(f'{n}. {title}',bookmark)
    destination=Path(destination);destination.parent.mkdir(parents=True,exist_ok=True)
    with destination.open('wb')as stream:writer.write(stream)
    result=PdfReader(destination)
    assert len(result.pages)==page_count
    assert not result.is_encrypted
    assert len(result.outline)==len(tracks)
    print(f'{destination}: {len(tracks)} numbered slides, {page_count} total frames, {destination.stat().st_size:,} bytes')

if __name__=='__main__':
    export(sys.argv[1],sys.argv[2])
