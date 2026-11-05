# Final editing-lease admission for protected saves

A bounded independent source review found that `writeStorageRaw` checked private lease identity before its final source/capture/context callbacks. A callback could explicitly withdraw that private lease while leaving the public source/context checks true. The old authority could attempt the append and only then return unconfirmed.

An actual-factory probe with synthetic MemoryStorage and an asynchronous exclusive fake-lock manager observed one effect after private withdrawal. The fake lock remained held until its retained callback completed. That evidence establishes the private admission gap; it establishes no ordinary-browser exploit, cross-document acquisition or cross-account leakage. No user records, browser storage, account or network were used.

## Resulting behavior

After the existing final source/capture/context checks, a private callback-free predicate requires the original lease to remain active and registered at the captured canonical key. No additional external callback runs in that final identity check. The same predicate supplies `currentLease`'s final membership check, preserving one authority. The append uses the captured key. Known pre-effect withdrawal returns held with zero append attempts and unchanged evidence.

Post-effect lease withdrawal or an exception after a storage effect remains unconfirmed. It cannot become a retryable held result or confirmed success. Public API types, envelope schemas, receipt encoding, legacy evidence, unknown stored fields, model validation and authorisation responsibilities remain unchanged. The factory's current consumers are the journal and invoice adapters. No geometry, farming estimates, species, lessons, roles, rules, dependencies, workflows or PLAN_VERSION change.

## Evidence

- Final ordered Node24 typecheck,442 affected tests across24files,whitespace and release-note checks pass with0fail/skip/TODO. Source/test bytes were unchanged during that run.
- Six new actual-factory cases use explicit synthetic contexts and real retained async fake-lock callbacks. An ordinary operation discovers pre-effect boundary positions. Fresh fixtures withdraw at every source guard and at the last storage-read and context callback; each must hold without a setItem attempt and preserve canonical,receipt and older copies. Success writes once; post-effect release/throw keeps one uncertain effect. Fixtures release and drain their locks.
- The unchanged regression was also loaded against the actual immutable `a7f1d56bafcfba3a0d0d1401756134394abfdded` authority using a private Node load hook and native type stripping. All three withdrawal cases failed; success and both post-effect controls passed. Working product files were not replaced or edited by that control.
- A second peer independently reviewed the final predicate,source diff,full new regression and journal/invoice adapters without authoring them. No actionable finding was reported within that bounded static scope.

The earlier442pass run covered an initial final-currentLease-call version. The recorded final run above covers the refined callback-free predicate. Current-head full CI,final integrated-main compatibility and real browser/account/deployed-rule requirements remain separate release gates. This change alters save admission rather than UI pixels; no new visual outcome is claimed. Browser access remains denied on this chat's supported surface; another authorised owner may independently inspect the exact hosted public preview without changing this session's permissions.
