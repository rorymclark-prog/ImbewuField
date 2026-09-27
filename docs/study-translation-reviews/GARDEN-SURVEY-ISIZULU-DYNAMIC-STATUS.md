# Garden Survey dynamic status — isiZulu draft

**Status:** AI draft, not checked by a fluent isiZulu speaker or a local farming adviser. The screen keeps the exact English recommendation beside the isiZulu sentence. The result summary pairs each new isiZulu status fragment with its English source.

Agy Gemini 3.8 Flash Low drafted the missing fragments on 26 September 2026. Only the language of existing display values changes; the farmer's answers, bed calculation, rainfall, tank count, area, crop names and save behavior are unchanged.

| English source | isiZulu draft | Use |
| --- | --- | --- |
| `no tanks yet` | `awekho amathangi okwamanje` | Recommendation and result summary when rain tanks are not selected. |
| `1 tank` | `ithangi elingu-1` | One selected tank. |
| `{n} tanks` for 2–20 | `amathangi angu-{n}` | Selected tank count; the number remains unchanged. |
| `full sun`, `partial shade`, `mostly shade` | Existing `SUN_OPTS[].zu` labels | Reuses the corresponding survey choice in the recommendation. |
| `total growing space` | `yonke indawo yokutshala` | Label after the existing square-metre calculation; English remains alongside. |

Agy flagged noun-class agreement for dynamic numerals and whether the growing-space label should use `yonke indawo yokutshala` or `isamba sendawo yokutshala`. The branch uses a separate singular and plural form and keeps English visible. A fluent reviewer should decide the preferred local register before the English pairing or draft notice is removed. No water-quality or irrigation advice was translated.
