# Quick-sale currency entry

The two existing quick-sale forms record South African rand (ZAR). They now say so before entry and link to the existing sale-invoice editor for its other supported currencies. The notice derives codes from the canonical invoice currency list. It does not infer currency from a country or language.

The destination is `/invoice?mode=sale`. Users choose the currency, sale basis and payment status in that editor. No product, amount, buyer, payment, account or site context is transferred by this link; the quick-sale draft is not transferred. Existing recorded-sale linking remains available through its established route.

The invoice editor already supports ZAR, KES, GBP, USD, EUR and BRL. This change introduces no save API, second ledger, currency conversion, automatic payment record or cross-device synchronization. Existing foreign invoices remain separate from rand totals. Legacy quick-sale saves, source guards, guide prices, uncertain-write handling and expense/edit paths retain their existing behavior.

A shared English notice appears only for new quick sales in My Records and the records ledger. It is outside disabled sale fieldsets so the alternative remains discoverable when records need review. It is absent from expense entry and edits of existing sales, where creating a second sale would be misleading.

This changes the picture. Root browser access is disabled, so phone/desktop placement is visually unverified. Current-head preview and genuine visual/account review remain release gates. Coordinator source review found no concrete issue in this narrow slice. Node24 typecheck, all590 affected cases across38 files and whitespace checks passed. The existing actual-form cases retain uncertain-write, pending-sync, double-submit and actor/sample transition coverage; three additional cases verify the notice/destination without saving or transferring a draft and exclude expense/edit paths. No full-suite result is implied by this selected run. No production merge is included.

The earlier total-based foreign quick-sale adapter proposal was superseded after inspecting the existing currency-aware invoice editor. No precision defect was established; this navigation change performs no total-to-unit-price calculation.
