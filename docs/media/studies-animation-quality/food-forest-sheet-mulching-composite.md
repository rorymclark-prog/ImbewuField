# Food Forest slide 16 sheet-mulching composite — 22 September 2026

**Held for Rory's approval.** Rory requires explicit review of SVG or code-drawn
animation quality. This authored composite is no longer registered in the
student player, and its generated MP4 and poster were removed from `public/`.
The source script and this record remain solely to make the draft reviewable.
The current Flow close-up candidate is recorded in
[`food-forest-flow-mulch-closeup.md`](food-forest-flow-mulch-closeup.md).

The existing eight-second Flow movie ends with broad cardboard exposed and mulch
still beside it. The held draft retained it as the setup segment, then followed it by a
five-second authored illustration. The illustration shows loose chips settling
above one continuous pale cardboard layer on distinct brown soil. Its only
labels are `Mulch`, `Cardboard`, `Soil`, and `Illustrated layer order`.

Build it locally with:

```bash
python3 docs/media/studies-animation-quality/render-sheet-mulching-layer-order.py --output-dir public/course-animations/food-forest
mv public/course-animations/food-forest/sheet-mulching-layer-order.jpg public/course-animations/food-forest/posters/sheet-mulching-layer-order.jpg
```

The builder takes its repository-relative input from
`public/course-animations/food-forest/flow-sheet-mulching.mp4`, creates temporary
frames outside the repository, and produces only the named MP4 and JPEG. It does
not call an image or video generation service and spends no credits.

| File | SHA-256 | Bytes |
| --- | --- | ---: |
| Original setup movie | `5bc8868d14b7e1c46978a297fa748cf5b340bf701b701130a767a5fcbbacbbfb` | 7,483,690 |
| Original setup poster | `568320ab4537fee7503d7597f87ebf87a93e15f2fa4f237b2225e867c1a9c2a2` | 474,783 |
| Composite movie | `d7079434ab964cdf0aadcc9b75d7555b80758abe09dc3582dc380d6206d0d21a` | 8,265,843 |
| Composite poster | `6e971f260b6761576410fb5170c69b23b17b591f9992673fd6b0322575654f08` | 64,763 |

The existing layer-order review cites University of California Agriculture and
Natural Resources guidance that places a final mulch layer above cardboard; see
[`food-forest-sheet-mulch-still.md`](food-forest-sheet-mulch-still.md). The
lesson's existing safeguards still apply: use plain cardboard where appropriate,
leave trunks clear, and keep water able to enter the soil.

This is an illustrated relationship, not evidence that the filmed patch was
covered, a quantity recommendation, a timing recommendation, or a promised
planting result. The original Flow source was already recorded as Google Flow /
Veo 3.1 Quality and 100 existing credits in
`docs/media/studies-illustrated-release/flow-clips.json`; this composition places
no new order and makes no claim beyond the visible layer order.
