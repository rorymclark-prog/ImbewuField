# Rain impact: close-up candidate

Status: experimental, not registered or published. Replaces the rejected wide-view cosmetic-rain approach with a magnified surface-impact illustration. Target remains Soil Health slide 14; acceptance is not assumed.

## Image source

Built-in image_gen, 20 September 2026. Generated file `exec-deea5c41-f946-4bda-9c05-7ad6c42ed371.png`; copied without changing the original into `source.png`. The prior `../soil-rain/source.png` was the warm texture reference. The new source was inspected: detailed bare soil and loose leaf cover; no exposed vertical cutaway face, no underground flow, comparable soil material. No numerical agronomic claims.

## Motion review requirements

- Show a visible falling drop, liquid splash and detached brown grains on bare soil.
- Land the covered example on an actual leaf, never in empty space.
- Keep clear water and brown soil particles visually distinct.
- Keep material/anatomy stable. Label the artificial time/scale: magnified, slowed teaching illustration.
- Do not imply an infiltration rate, an amount of runoff, universal behaviour of all soils or a controlled field experiment.
- Check complete playback and impact frames at desktop and phone size; do not publish if the effects still read as cosmetic dots.
- Narration, actual rainfall context, field observation task and source checks are required before registering a public replacement.

The renderer authors qualitative drop/splash/particle motion, not a calibrated fluid or erosion simulation. The count and speed of particles are visual parameters, not measured soil properties. It demonstrates impact protection only; this is not yet the complete storm/runoff teaching sequence proposed in the earlier storyboard.

## Evidence

[USDA NRCS, Soil Armor](https://www.nrcs.usda.gov/state-offices/north-dakota/soil-health-principle-1-of-4-soil-armor), checked 20 September 2026, explains that surface cover dissipates raindrop energy and protects soil from erosion. Used only for this qualitative mechanism. US residue examples and application figures are not South African prescriptions.

## Rendering

`python3 docs/media/studies-animation-quality/rain-impact/render.py --out <review-folder>/impact-candidate.mp4`

1600×1100 at 24 fps. Deterministic starting conditions shared between panels. The textured source is a generated illustration; droplet refraction, crown splash and soil grains are authored. This candidate has no recorded narration and is not a Flow video.

## Rejected 2D motion

Inspected frames 76 and 84 from `render.py`. The crown reads as a pale outlined polygon rather than water; detached grains remain hard to distinguish at phone size. Rejected. No public assets changed.

## 3D material test underway

Blender 5.2.2 LTS installed from the official Homebrew cask to make physically shaded/refractive water over the same background illustration. `render-3d.py` creates a closed liquid crown, separate clear water beads and textured brown grains, with matched camera projection. This is still procedural teaching geometry, not a calibrated fluid simulation. The first Metal render crashed during shader compilation; CPU proof rendering is being used. Generated `.blend` and frame outputs stay in the Downloads review pack until inspected. Neither installation nor a completed render counts as visual acceptance.
