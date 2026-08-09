// Design Studio Shell (v2) — element/category/sheet icon lookup.
//
// Recraft (AI illustration) is NOT wired into this session — verified by tool search, zero
// results — so every element uses a real, functional lucide-react icon rather than an inert
// placeholder box. Every name below was checked against the installed lucide-react package
// (`require('lucide-react')`) before use; nothing here is a guessed export name.
//
// THE SEAM for swapping in illustrated art later: DesignElementDef already carries an optional
// `art?: string` field (lib/design-elements.ts: "Optional hand-drawn tile artwork, served from
// public/elements/. The emoji remains the fallback so adding this display seam cannot change an
// existing farmer's saved element."). getElementArt() below checks that field FIRST. So the
// day Recraft art exists, populating `def.art` on the real catalog is the entire change — no
// component in this shell needs to be touched, because they all render through this one
// function and never import an icon directly themselves.

import type { LucideIcon } from 'lucide-react';
import {
  Cylinder, Barrel, Droplet, Droplets, Waves, CircleDot, Container,
  Pickaxe, Sprout, Building2, Bird, Road, Fence,
  MapPin, Compass, Target, LayoutDashboard, CalendarClock,
  Plus, Eye, Layers, PenTool, Ruler, Undo2, Redo2, Box,
} from 'lucide-react';
import type { DesignElementDef, ElementCategory } from '@/lib/design-elements';
import type { SheetId } from '@/lib/design-studio-shell';

// Per-element icon, keyed by DesignElementDef.id. Only the Water catalog is populated for this
// phase; other elements fall back to their category icon (still real, never a blank box).
export const ELEMENT_ICON: Partial<Record<string, LucideIcon>> = {
  jojo_1000: Cylinder,
  jojo_2500: Cylinder,
  jojo_5000: Cylinder,
  jojo_10000: Cylinder,
  rain_barrel: Barrel,
  pond_small: Droplet,
  dam: Waves,
  borehole: CircleDot,
  tap_point: Droplets,
  water_trough: Container,
};

// One icon per ElementCategory, chosen to match CATEGORY_META's existing emoji semantics
// 1:1 where a literal lucide equivalent exists (earthworks' pickaxe emoji -> Pickaxe icon,
// growing's sprout emoji -> Sprout icon, water's droplet emoji -> Droplets icon).
export const CATEGORY_ICON: Record<ElementCategory, LucideIcon> = {
  water: Droplets,
  earthworks: Pickaxe,
  structure: Building2,
  growing: Sprout,
  animal: Bird,
  access: Road,
};

export type ElementArt =
  | { kind: 'image'; src: string }
  | { kind: 'icon'; Icon: LucideIcon };

/** THE isolated lookup every palette/canvas render goes through. */
export function getElementArt(def: DesignElementDef): ElementArt {
  if (def.art) return { kind: 'image', src: def.art };
  const byId = ELEMENT_ICON[def.id];
  if (byId) return { kind: 'icon', Icon: byId };
  return { kind: 'icon', Icon: CATEGORY_ICON[def.category] ?? Box };
}

// Line-kind icons (for the two line-producing Quick Actions and the Draw tool's in-progress
// line). LineShape['kind'] is 'swale' | 'fence' | 'path' | 'bedpath' | 'pipe' | 'drip' |
// 'windbreak' | 'greywater' (lib/design-canvas.ts) — only the kinds this shell can currently
// produce (pipe, swale) are populated; Fence is included because it is already a literal
// lucide icon and a natural fit if a later sheet needs it.
export const LINE_KIND_ICON: Partial<Record<string, LucideIcon>> = {
  pipe: Container,
  swale: Waves,
  fence: Fence,
};

export const SHEET_ICON: Record<SheetId, LucideIcon> = {
  site: MapPin,
  sector: Compass,
  zones: Target,
  water: Droplets,
  earthworks: Pickaxe,
  planting: Sprout,
  structures: Building2,
  whole: LayoutDashboard,
  phasing: CalendarClock,
};

export const TOOLBAR_ICON = {
  add: Plus,
  view: Eye,
  layers: Layers,
  draw: PenTool,
  measure: Ruler,
  sunWind: Compass,
  undo: Undo2,
  redo: Redo2,
} as const;
