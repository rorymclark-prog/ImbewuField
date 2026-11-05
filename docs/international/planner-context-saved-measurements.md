# Saved measurement evidence in the planner context fixture

The full PR1245 push job (run 41834119517, job 126588531800) completed with 7199 tests: 7197 passed, one failed and one existing TODO. The failing foreign-grower context case expected a display-bridge mock bed before any saved source had been checked. Reproduction at 4294a1bc produced the same 19-pass/one-fail result in that file.

The current planner deliberately withholds measured areas until its real source hook checks account-scoped saved canvas bytes. The fixture mocked only page display geometry; it neither saved a Studio canvas nor invoked that check. An independent read-only review confirmed this mismatch. Production measurement and country gates remain unchanged.

The positive fixture now first verifies missing-source holds, then saves one synthetic dimensioned bed and invokes the real measurement check. It verifies the exact bed, saved rectangle arithmetic, measured-area provenance and geometry fingerprint before retaining every existing profile-persistence, planting-preservation and foreign-advice assertion. The virtual-reference negative remains intact. Synthetic dimensions are test inputs, not farming recommendations.

Ordered Node 24 typecheck, 35 affected checks across the planner-context and source suites, and whitespace checks passed. The original failing log is retained privately. This changes no product UI or saved schema. Current-head CI remains a separate gate; older CI and this focused result do not establish a production release.
