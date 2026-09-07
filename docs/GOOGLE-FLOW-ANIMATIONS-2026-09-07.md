# Use Rory's existing Google plan for the lesson animations

Checked against Google's own help on 7 September 2026. If the subscription is **Google AI Pro**, Google currently lists **1,000 monthly Google Flow credits**, in addition to its daily Flow allowance. The exact account plan and remaining balance have not been inspected. Use the existing allowance for the first test; no new Higgsfield subscription is needed for this workflow.

Google's video model is called **Veo**. Google now says **Gemini Omni** is replacing Veo in the Gemini app. Use the image/frame-to-video model actually offered by the account; model availability and credit costs can change. The lesson prompts describe the action and preserve the reference picture, so they are not tied to one model version.

## First clip: the square compost heap

1. Open [Google Flow](https://labs.google/fx/tools/flow) with the Google account that owns the subscription. Check the plan and remaining credits under the profile picture.
2. Open a project. In the prompt box, select the model name, then **Video → Frames** if offered.
3. Upload `references/soil-health-slide-10-compost-building.png` as the start frame. This is the wordless illustration with the square heap and wheelbarrow. Do not upload the whole slide with its title and caption.
4. Paste the matching text from `rory-prompts/soil-health-slide-10-compost-building.txt`. Select landscape **16:9**, one output, and a generation duration that includes the full action. The edit target is 8 seconds; use the nearest supported duration and tell Codex the actual duration.
5. Ask for silent output. If the model adds sound anyway, return the original MP4 and Codex will mute it. Keep generated dialogue, music and voices out of the final lesson; Leah and Thando are added separately.
6. Watch the beginning, middle and end. The heap must keep its square footprint and flat top; material should leave the hand and land on the heap; fingers, tools and wheelbarrow must not change shape. No magical whole-heap transformation.
7. Return `soil-health-slide-10-compost-building.mp4`. Keep the original provider export and its provenance. If a visible provider watermark appears, tell Codex before making the other clips; prompting cannot override export restrictions.

Try **one** clip first. A good still is not evidence that a model will animate the farming action correctly. Use the supplied picture and an uncomplicated fixed-camera motion before spending credits on the remaining scenes.

## Starting frames now supplied

| Clip | Image | Status |
| --- | --- | --- |
| Soil Health 10 — compost | Square heap, flat top, wheelbarrow | Supplied |
| Soil Health 5 — soil observation | Inspecting a soil sample | Supplied |
| Introduction 7 — sharing water | Bucket opening directly below the tap | Supplied |
| Introduction 13 — diversity | Two equally exposed plots before the storm | Supplied |

The remaining eight Rory-owned starting frames are still in production. There are 12 illustrated clips for Rory and 16 precise process animations for Codex. This split remains unchanged.

For the diversity clip, both plots receive the same storm and both show damage. For water sharing, a bucket level must never stand in for groundwater monitoring. The notebook stays blank until a deliberate overlay is added. These are teaching illustrations, not evidence of measured crop performance or borehole yield.

## Official sources

- [Google Flow credit allowances and balance](https://support.google.com/flow/answer/16526234?hl=en)
- [Create videos and add start frames](https://support.google.com/flow/answer/16353334?hl=en)
- [Google's video models and Gemini Omni transition](https://gemini.google/overview/video-generation/)

No Google account was accessed and no Google credits were spent by Codex to prepare this pack.
