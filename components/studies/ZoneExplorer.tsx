'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react';
import { LESSON_INDEX } from '@/lib/course-modules';
import Summary from './Summary';
import styles from './ZoneExplorer.module.css';

// These are screen-space annotations of a fictional teaching scene. They never
// enter the design editor or change a learner's saved site measurements.
export const ZONE_MAP_AREAS = [
  { id: '0', label: 'House', marker: '0', colour: '#e99586', points: '1000,488 1403,494 1420,678 1283,676 1283,630 989,621', x: 1204, y: 555, camera: [1200,585,2.4] },
  { id: '1', label: 'Picking garden', marker: '1', colour: '#48c6b0', points: '985,541 944,547 854,596 827,651 826,752 823,810 915,895 1335,894 1342,679 1284,679 1281,631 989,623', x: 1104, y: 772, camera: [1090,730,2] },
  { id: '2', label: 'Main garden + animals', marker: '2', colour: '#a0cb6c', points: '25,530 100,340 360,320 515,355 570,405 615,365 720,230 845,165 975,205 1020,300 1060,365 1000,475 970,530 840,582 750,631 773,724 771,811 744,854 629,868 503,857 361,874 177,842 36,816 4,738 17,627', x: 401, y: 640, camera: [440,610,1.7] },
  { id: '3', label: 'Main field · maize', marker: '3', colour: '#efba63', points: '0,0 855,0 824,85 759,157 697,251 652,316 620,375 570,405 515,355 360,320 100,340 25,530 0,546', x: 385, y: 155, camera: [365,210,1.65] },
  { id: '4', label: 'Semi-wild', marker: '4', colour: '#c2a1e2', points: '855,0 1120,0 1125,93 1215,160 1335,247 1475,287 1608,354 1672,365 1672,538 1535,535 1433,488 1405,475 1000,475 1060,365 1020,300 975,205 845,165 720,230 615,365 570,405 620,375 661,307 702,241 761,156 826,80', x: 1020, y: 112, camera: [1210,310,1.6] },
  { id: '5', label: 'Wild', marker: '5', colour: '#7abedf', points: '1120,0 1672,0 1672,365 1608,354 1475,287 1335,247 1215,160 1125,93', x: 1471, y: 132, camera: [1450,160,2] },
  { id: 'food-forest', label: 'Food forest', marker: 'F', colour: '#f7eee0', points: '720,230 845,165 975,205 1020,300 1060,365 1000,475 970,530 840,582 680,517 590,448 615,365', x: 810, y: 385, camera: [830,370,2.2] },
  { id: 'fruit-trees', label: 'Fruit trees', marker: 'T', colour: '#f7eee0', points: '1000,180 1150,130 1290,175 1400,265 1450,385 1360,475 1090,470 1030,365 1000,280', x: 1220, y: 300, camera: [1220,290,2.1] },
  { id: 'kraal', label: 'Kraal · cow + goats', marker: 'K', colour: '#f7eee0', points: '125,350 270,332 438,350 489,408 470,465 353,505 195,481 125,429', x: 300, y: 445, camera: [305,420,2.6] },
] as const;
type AreaId = typeof ZONE_MAP_AREAS[number]['id'];
export const ZONE_TOUR = ['0', '1', '2', 'kraal', 'food-forest', '3', '4', 'fruit-trees', '5'] as const;

function areaDescription(id: AreaId) {
  if (id === 'food-forest') return 'Trees, smaller plants and ground cover grow together here. A food forest describes layered planting; its zone depends on how often it needs care and harvesting.';
  if (id === 'fruit-trees') return 'These are the fruit trees in this example. Fruit trees can belong in different zones according to their care and harvesting needs.';
  if (id === 'kraal') return 'A cow and goats are shown in a kraal beside the main garden. This picture does not specify pen size or stocking.';
  // Read the checked lesson instead of maintaining another version of its definitions.
  const body = LESSON_INDEX.get('intro-permaculture-l3')?.lesson.body ?? '';
  return body.match(new RegExp(`(?:In this example, )?Zone ${id}\\b[^.]*\\.`))?.[0] ?? '';
}

export default function ZoneExplorer({ lang = 'en', initialFeature, initiallyOpen = false }: { lang?: string; initialFeature?: 'food-forest'; initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  const [visible, setVisible] = useState<AreaId[]>(initialFeature ? [initialFeature] : ZONE_MAP_AREAS.map(a => a.id));
  const [selected, setSelected] = useState<AreaId | null>(initialFeature ?? null);
  const [tour, setTour] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [imageError, setImageError] = useState(false);
  const active = ZONE_MAP_AREAS.find(a => a.id === selected);
  const camera = tour !== null && active ? active.camera : [836,470.5,1];
  const [cx,cy,scale] = camera;
  const tx = Math.max(100-scale*100,Math.min(0,50-cx/1672*scale*100));
  const ty = Math.max(100-scale*100,Math.min(0,50-cy/941*scale*100));

  const goToStep = useCallback((step: number) => {
    const next = Math.max(0,Math.min(ZONE_TOUR.length-1,step));
    const id = ZONE_TOUR[next];
    setTour(next);setSelected(id);setVisible([id]);
    if (next === ZONE_TOUR.length-1) setPlaying(false);
  }, []);
  useEffect(() => {
    if (!open || !playing || tour === null) return;
    const timer = window.setTimeout(() => goToStep(tour+1),5000);
    return () => window.clearTimeout(timer);
  }, [open,playing,tour,goToStep]);

  function toggle(id: AreaId) {
    setPlaying(false);setTour(null);
    setVisible(current => current.includes(id) ? current.filter(item => item !== id) : [...current,id]);
    setSelected(id);
  }
  function overview(show: boolean) {
    setPlaying(false);setTour(null);setSelected(null);
    setVisible(show ? ZONE_MAP_AREAS.map(a => a.id) : []);
  }

  return <details className={styles.explorer} lang="en" open={open} onToggle={event => {
    setOpen(event.currentTarget.open);
    if (!event.currentTarget.open) setPlaying(false);
  }}>
    <Summary>{initialFeature ? 'Explore the food forest and farm zones' : 'Explore the farm zones'}</Summary>
    {open && <div className={styles.content}>
      {lang !== 'en' && <p className={styles.caption}>English interactive example</p>}
      <p>Tap a zone to turn its highlight on or off, or follow the map tour.</p>
      {!initiallyOpen && <a className={styles.largerLink} href="/student/zones">Open a larger map</a>}
      <div className={styles.actions}>
        <button type="button" onClick={() => {goToStep(0);setPlaying(false);}}>Start map tour</button>
        <button type="button" onClick={() => overview(true)}><RotateCcw size={15} aria-hidden="true" /> Show all</button>
        <button type="button" onClick={() => overview(false)}>Clear highlights</button>
      </div>
      <div className={styles.switches} role="group" aria-label="Zone highlights">
        {ZONE_MAP_AREAS.slice(0,6).map(area => <button type="button" key={area.id} aria-pressed={visible.includes(area.id)} onClick={() => toggle(area.id)}>
          <span className={styles.swatch} style={{background:area.colour}} aria-hidden="true" />{area.id} · {area.label}
        </button>)}
      </div>
      <div className={styles.switches} role="group" aria-label="Find in this example">
        {ZONE_MAP_AREAS.slice(6).map(area => <button type="button" key={area.id} aria-pressed={visible.includes(area.id)} onClick={() => toggle(area.id)}>{area.marker} · {area.label}</button>)}
      </div>
      {tour !== null && <div className={styles.actions} role="group" aria-label="Map tour controls">
        <button type="button" onClick={() => {setPlaying(false);goToStep(tour-1);}} disabled={tour===0}><ChevronLeft size={16} aria-hidden="true" /> Previous</button>
        <button type="button" onClick={() => setPlaying(value => !value)} disabled={tour===ZONE_TOUR.length-1}>{playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}{playing ? 'Pause tour' : 'Play tour'}</button>
        <button type="button" onClick={() => {setPlaying(false);goToStep(tour+1);}} disabled={tour===ZONE_TOUR.length-1}>Next <ChevronRight size={16} aria-hidden="true" /></button>
        <span className={styles.caption}>Stop {tour+1} of {ZONE_TOUR.length}</span>
      </div>}
      <div className={styles.viewport} data-tour-step={tour ?? 'overview'}>
        {!imageError ? <>
          <div className={styles.camera} style={{transform:`translate(${tx}%,${ty}%) scale(${scale})`}}>
            {/* A single photograph moves as one with its overlays, keeping every outline registered. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/study-images/zone-explorer/holding.webp" alt="Fictional South African smallholding with a courtyard home, gardens, maize, kraal with a cow and goats, layered food forest, fruit trees and wild woodland" width={1672} height={941} onError={() => setImageError(true)} />
            <svg viewBox="0 0 1672 941" aria-hidden="true">
              {ZONE_MAP_AREAS.map((area,index) => <polygon key={area.id} data-zone-area={area.id} data-visible={visible.includes(area.id)} points={area.points}
                fill={area.colour} fillOpacity={index<6 ? .13 : selected===area.id ? .18 : 0} stroke={area.colour} strokeWidth={2/scale} strokeDasharray={index<6 ? undefined : `${6/scale} ${4/scale}`} vectorEffect="non-scaling-stroke" />)}
            </svg>
          </div>
          {ZONE_MAP_AREAS.filter(a => visible.includes(a.id)).map(area => <span key={area.id} className={styles.marker} style={{left:`${area.x/1672*scale*100+tx}%`,top:`${area.y/941*scale*100+ty}%`}} aria-hidden="true">{area.marker}</span>)}
        </> : <p className={styles.imageError}>The example image could not load. The zone descriptions and controls remain available.</p>}
      </div>
      <p className={styles.caption}>AI-generated teaching scene · not a measured site plan</p>
      <div className={styles.description} aria-live="polite" aria-atomic="true">
        <h3>{active ? `${active.id.length===1 ? `Zone ${active.id} · ` : ''}${active.label}` : 'One holding, different patterns of care'}</h3>
        <p>{selected ? areaDescription(selected) : 'Zones follow how often you need to visit. These outlines illustrate one example; they are not fixed distances or boundaries for your farm.'}</p>
      </div>
      <details className={styles.about}><Summary>About this example</Summary>
        <p>The food forest is layered planting, not another numbered zone. Its position here is an example. The map tour pans and zooms a photograph; it is not drone footage.</p>
        <p><a href="https://www.permaculture.org.uk/design-methods/zoning" target="_blank" rel="noreferrer">Permaculture Association: zoning</a> · <a href="https://www.permaculture.org.uk/practical-solutions/forest-gardens" target="_blank" rel="noreferrer">Forest gardens</a></p>
      </details>
    </div>}
  </details>;
}
