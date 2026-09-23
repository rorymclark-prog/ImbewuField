# Introduction L3 source correction proposal — 23 September 2026

**Scope:** English slides 15–20 only. This is the source and asset audit that
preceded the coordinated English correction recorded in
[the L3 lesson check](intro-l3-lesson-check.md). It is not human or practitioner
approval. Keep `PLAN_VERSION` unchanged.

## Source findings

- The current L3 body in `lib/course-modules.ts` and slide 18 narration assert that a Lowveld farm gets hot, dry berg winds from the north-west in August, and that KZN has a summer rain sector from the north-east. These combine a real seasonal phenomenon with unsupported site direction claims.
- SAWS describes berg winds as hot, dry winds blowing off the interior plateau, roughly at right angles to the coast, and says they usually occur in winter. That does not establish a north-west direction for a Lowveld farm. [SAWS: Weather Questions](https://www.weathersa.co.za/home/weatherques)
- ARC offers measured wind speed and direction, including wind roses, with hourly through long-term station data. Use local observations or nearby station records to determine a farm's wind sector. [ARC-ISCW: Climate Monitoring Services](https://www.arc.agric.za/arc-iscw/Pages/Climate-Monitoring-Services.aspx)
- The cited CSIR EIA describes summer-dominant rainfall for the north-coast study area. It separately says north-east winds become more frequent there in summer. It does not say rain comes from the north-east throughout KZN; wind direction is not evidence of rain direction. [CSIR: Tongaat Desalination Project EIA, Chapter 3, §3.3.1](https://www.csir.co.za/sites/default/files/DEIAR_UW_Chap_3_Affected%20environment_Tongaat_050518_Low%20Res.pdf)
- For the quiz's Highveld example, a South African government Highveld Priority Area assessment reports daytime surface winds predominantly north to north-west over the assessment area, with winter wind patterns varying and material differences between monitoring stations. This supports a broad regional pattern, not a claim that every Highveld farm gets hot, dry north-westerlies in August. Keep the quiz conditional on a wind actually observed at that farm, or recast the location as a hypothetical. [Highveld Priority Area Air Quality Management Plan, §2.3.2](https://screening.environment.gov.za/ScreeningDownloads/DevelopmentZones/HIGHVELD_PRIORITY_AREA_AQMP.pdf)

## Slide and still audit

| Slide | Current still / visible claim | Recommendation for a coordinated English correction |
|---|---|---|
| 15 | `public/course-decks/intro-permaculture/en/slide-15.jpg`: labelled diagram of a house inside outward rings; incoming sun, wind and water symbols have no regional direction claim. | Reuse. It supports zones as a spatial layout. Keep the rings illustrative; actual placement follows visit frequency and the farm's layout. |
| 16 | `.../slide-16.jpg`: smallholder harvesting in a garden near a house; no written spacing, species or regional claim is baked in. | Reuse unchanged. The existing daily-harvest example is local to the illustration and does not assert weather data. |
| 17 | `.../slide-17.jpg`: text says “Zones do not organise space.” This is an absolute statement, while slide 15 and the narration draw zones as spatial rings. | Correct the sentence in the same English content pass. Preserve the useful point that visit frequency guides placement; avoid implying zones have no spatial layout. The exact learner wording needs editorial approval. |
| 18 | `.../slide-18.jpg`: bakes in “A Lowveld farm facing north-west gets hot dry berg winds in August.” The narration and body also say KZN's summer rain sector is from the north-east; this second claim is not printed on the still. | Replace the regional wind sentence on the still and in body/narration with a local-observation prompt. Remove the north-east rain direction claim from body/narration; keep rainfall seasonality only at a scope supported by the chosen source. The slide image itself must be regenerated because its text is baked in. |
| 19 | `.../slide-19.jpg`: illustration labels “Wind from the north-west”; its small upper caption says “Illustrated wind flow.” The narration calls it an example and tells learners to observe their own site. | Reuse the illustration only with an explicit, readable “example” cue beside the direction label. The current still alone can read as a general direction instruction. The 1920 × 1080 large-label review candidate visibly puts “Look at this example” immediately above “Wind from the north-west” and adds “Observe your own site. This picture is not a planting plan”; inspect it at phone fit before any registration. |
| 20 | `.../slide-20.jpg`: two people discuss a hand sketch; no fixed wind or rain direction is legible in the image. | Reuse unchanged. Keep the field task focused on drawing arrows from local observations and identifying their source. |

## Narrow proposed teaching change

In the body, slide 18 narration, transcript and its still caption, remove the fixed Lowveld/north-west/August and KZN/north-east rain-sector assertions. Replace them with a plain instruction to observe or check local wind and water arrival directions before drawing sector arrows. Keep the supported general explanation that sectors describe influences arriving across a site boundary. In the quiz, make the north-west wind an explicitly observed or hypothetical condition for that farm; the placement reasoning can remain conditional on the wind's actual source.

The slide 17 statement needs a separate wording decision in the same pass because the current still directly conflicts with the spatial rings shown on slide 15. Do not broaden this proposal into a rewrite of the lesson's zones, quiz rationale, or other slides.

## Coordination and remaining checks

If approved, coordinate the English body, slide 17/18 stills and narration, transcript, affected MP3s, combined English narration, asset-size manifest and offline cache version/removal rules. Slide 19's source illustration can remain, subject to the visible example qualifier. No direction, rainfall sector, date, measurement, species or planting distance is proposed as fact.

Rory's 23 September request to complete the core modules in English is the
task scope for the coordinated correction. This packet records the evidence;
the release checks and any remaining limits are in the lesson check. Human,
practitioner, learner and fluent isiZulu review remain open.
