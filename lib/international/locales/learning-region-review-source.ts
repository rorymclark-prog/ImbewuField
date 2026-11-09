/** Review-only source identities. The capture was uncommitted: no Git anchor is invented. */
export const LEARNING_REGION_REVIEW_SOURCE = Object.freeze({
  sourceSha256: '85c38bfe7d3209b39886dbf9eb70019810e1f37c6f64587df370a14587889f74',
  sourceFile: 'components/studies/LearningRegionNotice.tsx' as const,
  sourceFileSha256: '334871cadceedffd6dd2c6de33a9457ade8b89882685c03e5bcebb81488ae747',
  sourceFileBytes: 9886,
  sourceCommit: null,
  capturedOn: '2026-11-07',
  sourceState: 'hash-pinned-uncommitted-component',
  messageCount: 28,
  fragmentCount: 13,
  fixedLiteralKeys: ['learningRegionUi014', 'learningRegionUi021'] as const,
  packetSha256: Object.freeze({
    'fr': '114579c1fa65e1ae84f8710813235206f84da0fc70b73959672612d8cfd77445',
    'es': 'f781c251dc6d4740d9df1c5da5aa76e4f07613d5beb386b69c9d623f84978083',
    'pt-BR': '38ee747170e97269b9820e17895bd2140604575aeb2fd080394f052c6316e0e7',
    'sw': 'e12f0e28761d9f679878a9cb93a1419fab4aa59b67bb82d21d55893f1854ef41',
    'hi': 'd9dc3a58f87fa7a62c685bef3b9d1f16d1aa6aac34733b5c0deefa2e163c8216',
    'bn': 'e696da379d3883e71fecb5eb551630db2dbe7c8d023af3688a5179afe557c946',
    'id': 'eca672aa7c591cdb31a8fe55e02b59c27fab1bf68c262d24d31a3bd15ae00641',
    'de': '808550fecb44bf3ad90d4cfeef5a0836b8b8773876f123361cc6864961a00a30',
    'it': '030591f5e8c5344239e932b590b23044c5a9d8cde2fe37df2336583760d8e67d',
    'nl': '6c9ae2f78521b96f1d66b201266f1328492bce5350a8ae130a3a12dd29d0f624',
    'pl': '951040648a103f983d0ae0689114c2e793dfef6bab903b9749f312fa7e090361',
  }),
});
export const LEARNING_REGION_REVIEW_LOCALES = ['fr', 'es', 'pt-BR', 'sw', 'hi', 'bn', 'id', 'de', 'it', 'nl', 'pl'] as const;
export type LearningReviewLocale = typeof LEARNING_REGION_REVIEW_LOCALES[number];
