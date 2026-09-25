'use client';

/**
 * The Design Studio's visible status for its unreviewed isiZulu interface drafts.
 * Farming and measurement guidance stays in its exact English source until reviewed.
 */
export default function DesignZuluDraftNotice() {
  return (
    <div
      role="note"
      lang="en"
      style={{
        padding: '5px 9px',
        borderRadius: 8,
        background: 'rgba(192,122,30,0.10)',
        color: '#5C3B0D',
        fontSize: 10.5,
        lineHeight: 1.35,
      }}
    >
      <strong>Unreviewed isiZulu draft.</strong> English follows each translated Design Studio step or guide control label. Farming and measurement guidance remains in English.
    </div>
  );
}
