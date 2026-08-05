'use client';

import { Handshake, Leaf, Package, ShoppingBasket, Sprout, Wrench } from 'lucide-react';
import { EX } from './theme';

/**
 * The teaching panel. Two entry points, one body:
 *
 *  • `variant="board-empty"` — nothing on the board at all. This is the true
 *    empty state, and an empty marketplace is the hardest screen in the product:
 *    it has to explain what the thing is for before anyone will put the first
 *    item in it.
 *  • `variant="intro"` — the board has listings but the farmer has never posted.
 *    Same explanation, shown as an intro card, because a lesson nobody reaches
 *    is not a lesson. With the sample board loaded the empty variant would
 *    otherwise be unreachable.
 */
export default function ExchangeGuide({
  variant,
  onPost,
}: {
  variant: 'board-empty' | 'intro';
  onPost: () => void;
}) {
  const examples: Array<{ icon: typeof Leaf; label: string; example: string }> = [
    { icon: Leaf, label: 'Seed', example: 'Two kilos of sugar bean seed off last season' },
    { icon: Sprout, label: 'Seedlings', example: 'A tray of tomato seedlings hardened off and ready' },
    { icon: ShoppingBasket, label: 'Surplus produce', example: 'The chard you are cutting faster than you can sell' },
    { icon: Wrench, label: 'Tools and labour', example: 'A planter to hire by the day, or two days of work-share' },
  ];

  const steps = [
    'Tap "Post a listing" and choose whether you are offering something or looking for it.',
    'Pick the crop from the list so other farmers searching for it actually find you.',
    'Say how much you have, and whether you want Rand, a swap, or nothing at all.',
    'Add your nearest town so people can see roughly how far away you are.',
  ];

  return (
    <div
      className="rounded-2xl"
      style={{
        background: EX.card,
        border: `1px solid ${EX.border}`,
        padding: variant === 'board-empty' ? '28px 20px' : '20px',
      }}
    >
      <div className="flex items-center gap-2.5" style={{ marginBottom: 10 }}>
        <Handshake size={20} strokeWidth={1.7} style={{ color: EX.green, flexShrink: 0 }} />
        <h2 className="font-display font-bold" style={{ fontSize: 17, color: EX.ink, margin: 0 }}>
          {variant === 'board-empty' ? 'Nothing on the board yet' : 'What the exchange is for'}
        </h2>
      </div>

      <p className="font-sans" style={{ fontSize: 13.5, lineHeight: 1.6, color: EX.muted, margin: '0 0 16px' }}>
        The exchange is where farmers find each other. Seed that would otherwise sit in a bucket,
        seedlings from someone who over-sowed, a surplus you cannot sell in your own village, a tool
        that stands idle six days a week — all of it is worth more to a farmer twenty kilometres away
        than it is to you. List what you have, or say what you are looking for, and sort the board by
        who is nearest.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
        {examples.map(({ icon: Icon, label, example }) => (
          <div key={label} className="flex items-start gap-2.5">
            <div
              className="flex items-center justify-center rounded-lg flex-shrink-0"
              style={{ width: 28, height: 28, background: 'rgba(31,77,43,0.08)', marginTop: 1 }}
            >
              <Icon size={14} strokeWidth={1.8} style={{ color: EX.green }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="font-sans font-semibold" style={{ fontSize: 13, color: EX.ink }}>{label}</div>
              <div className="font-sans" style={{ fontSize: 12.5, color: EX.faint, lineHeight: 1.45 }}>{example}</div>
            </div>
          </div>
        ))}
      </div>

      <div
        className="rounded-xl"
        style={{ background: 'rgba(226,216,196,0.38)', padding: '14px 16px', marginBottom: 16 }}
      >
        <div
          className="font-sans uppercase"
          style={{ fontSize: 10, letterSpacing: '0.12em', color: EX.faint, marginBottom: 8 }}
        >
          Posting your first listing
        </div>
        <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
          {steps.map((step, i) => (
            <li key={step} className="flex items-start gap-2.5">
              <span
                className="font-sans font-bold flex items-center justify-center rounded-full flex-shrink-0"
                style={{ width: 18, height: 18, fontSize: 10.5, background: EX.green, color: EX.card, marginTop: 1 }}
              >
                {i + 1}
              </span>
              <span className="font-sans" style={{ fontSize: 12.5, color: EX.muted, lineHeight: 1.5 }}>{step}</span>
            </li>
          ))}
        </ol>
      </div>

      <button
        onClick={onPost}
        className="font-display font-semibold rounded-xl"
        style={{
          width: '100%',
          padding: '11px',
          fontSize: 14,
          background: EX.green,
          color: '#F7F2E9',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        Post a listing
      </button>

      <div className="flex items-start gap-2" style={{ marginTop: 14 }}>
        <Package size={13} strokeWidth={1.8} style={{ color: EX.faint, marginTop: 2, flexShrink: 0 }} />
        <p className="font-sans" style={{ fontSize: 11.5, lineHeight: 1.5, color: EX.faint, margin: 0 }}>
          A listing you post is saved on this phone only. It is not sent to other farmers, and nobody
          else can see it yet — see &ldquo;What this preview does not do&rdquo; at the bottom of the board.
        </p>
      </div>
    </div>
  );
}
