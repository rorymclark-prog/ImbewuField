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

## 3D proof findings

The first procedural 3D crown was rejected after inspecting frame 76 and a closer frame 80: transparency/reflections improved, but the regular geometry resembled a glass ornament. `simulate-impact.py` now bakes a bounded 64-frame Mantaflow drop impact. The bake completed on CPU in about 16 seconds. That is computational timing, not field time.

The initial cached liquid showed flat triangular normals and refraction of a distant image plane. `refine-liquid.py` applies smooth surface normals and projects the image onto a receiver at the actual collision surface. It preserves the camera view while avoiding a detached background refraction. Still frames 38 and 44 were inspected after correcting the receiver's height. The result is an improved liquid-material study, **not an accepted teaching clip**: the simulated surface is flat/non-absorbing, the pictured soil has relief, and this model does not yet show soil grains detaching or a matched covered-surface interaction. Do not represent the spread as a runoff or infiltration result. No narration or production registration has been added.

A short cached-motion render is being reviewed next. To proceed to a publication candidate, either obtain and inspect the actual Flow export or build a coherent 3D surface/collision scene matching the visible materials. Do not publish a pretty but physically disconnected overlay.

Reproduction:

1. `blender -b -P docs/media/studies-animation-quality/rain-impact/simulate-impact.py -- --out <absolute-review-folder> --frame 44 --samples 48 --width 1600 --focus bare`
2. `blender -b <absolute-review-folder>/liquid-proof.blend -P docs/media/studies-animation-quality/rain-impact/refine-liquid.py -- <absolute-review-folder>`

`--gpu` is opt-in because Metal shader compilation crashed on this host; CPU renders completed successfully. The `.blend` and simulation cache are review outputs, not app assets. Blender 5.2.2 came from the official Homebrew cask; no paid animation credits were used in this iteration.

Verification on the app baseline: typecheck clean; 3,639 tests, 3,638 passes, zero failures, one pre-existing TODO; `git diff --check` clean. These validate repository compatibility, not visual acceptance.

## Coherent terrain checkpoint — 21 September 2026

`terrain-scene.py` replaces the photo receiver with an actual closed soil surface and irregular aggregate geometry. Both the visible soil and curled leaf meshes participate in liquid collision. The same deterministic ground, camera and initial drop are used before adding cover. This removes the earlier mismatch between a flat collision plane and a photograph of uneven soil.

New built-in image-generation textures are retained as `soil-albedo.png` and `leaf-albedo.png`, with their exact prompts. They are generated material references, not field photographs. Images are packed into review blend files; no paid Flow credits were used for this checkpoint. A sparse aggregate version was rejected because it resembled scattered boulders. The denser textured scene was inspected at bare-surface frames 38 and 44; covered-surface frames 32 and 44 show the drop contacting the leaf mesh. A matching smooth-normal/lighting pass and full motion review remain outstanding.

The current model does **not** detach soil grains and treats the ground as non-absorbing. It can illustrate which surface a drop contacts first; it does not demonstrate erosion quantities, infiltration or the result of a whole storm. Do not label this a field experiment. The leaf texture repeats visibly and the liquid remains an enlarged CG study. This checkpoint is **not approved for publication**.

Reproduce each scene with `simulate-impact.py -- --out <folder> --frame 44 --samples 32 --width 1200 --focus bare --terrain` (replace `bare` with `mulch` for cover), then open `<folder>/liquid-proof.blend` and run `shade-terrain.py -- <folder>`. CPU rendering remains the supported local path.

Repository verification: typecheck clean; 3,639 tests, 3,638 passes, zero failures, one existing TODO; whitespace check clean. The public slide and narration remain unchanged.
