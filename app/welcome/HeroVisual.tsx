'use client';

type HeroVisualProps = {
  className?: string;
};

/**
 * A decorative farm plan built from the same hand-drawn elements used by the
 * design tool. Each piece arrives independently, as if the plan is being laid
 * out on the plot; reduced-motion users see the completed plan immediately.
 */
export default function HeroVisual({ className = '' }: HeroVisualProps) {
  return (
    <div className={`heroVisual ${className}`} aria-hidden="true">
      <div className="plotGrid" />
      <div className="plotOutline" />

      <div className="piece berm">
        <img src="/element-art/berm.png" alt="" width={192} height={192} />
      </div>
      <div className="piece pond">
        <img src="/element-art/pond_small.png" alt="" width={192} height={192} />
      </div>
      <div className="piece mango">
        <img src="/element-art/tree_mango.png" alt="" width={192} height={192} />
      </div>
      <div className="piece tank">
        <img src="/element-art/jojo_2500.png" alt="" width={192} height={192} />
      </div>
      <div className="piece banana">
        <img src="/element-art/banana_circle-v3.png" alt="" width={192} height={192} />
      </div>
      <div className="piece coop">
        <img src="/element-art/chicken_coop.png" alt="" width={192} height={192} />
      </div>
      <div className="piece hive">
        <img src="/element-art/beehive.png" alt="" width={192} height={192} />
      </div>
      <div className="piece spekboom">
        <img src="/element-art/tree_spekboom.png" alt="" width={192} height={192} />
      </div>

      <style jsx>{`
        .heroVisual {
          position: relative;
          isolation: isolate;
          width: 100%;
          max-width: 580px;
          aspect-ratio: 1.2 / 1;
          margin-inline: auto;
          overflow: hidden;
          background: transparent;
        }

        .plotGrid,
        .plotOutline {
          position: absolute;
          z-index: 0;
          left: 8%;
          right: 7%;
          bottom: 7%;
          height: 66%;
          border-radius: 42% 46% 16% 18% / 20% 22% 12% 14%;
          transform: perspective(540px) rotateX(58deg) rotateZ(-3deg);
          transform-origin: center bottom;
        }

        .plotGrid {
          opacity: 0;
          background-image:
            linear-gradient(rgba(31, 77, 43, 0.12) 1px, transparent 1px),
            linear-gradient(90deg, rgba(31, 77, 43, 0.12) 1px, transparent 1px);
          background-size: 11% 18%;
          animation: gridIn 440ms ease-out 40ms forwards;
        }

        .plotOutline {
          border: 2px solid rgba(31, 77, 43, 0.18);
          box-shadow: inset 0 0 0 1px rgba(247, 242, 233, 0.52);
          opacity: 0;
          animation: gridIn 440ms ease-out 40ms forwards;
        }

        .piece {
          --enter-x: 0px;
          --enter-y: -28px;
          --settle-rotation: 0deg;
          position: absolute;
          z-index: 1;
          opacity: 0;
          transform-origin: 50% 88%;
          animation: settle 520ms cubic-bezier(0.22, 0.82, 0.36, 1.18) forwards;
        }

        .piece img {
          display: block;
          width: 100%;
          height: auto;
          user-select: none;
          filter: drop-shadow(0 7px 7px rgba(52, 45, 31, 0.13));
        }

        .berm {
          --enter-x: -42px;
          --enter-y: 18px;
          --settle-rotation: -5deg;
          left: 8%;
          bottom: 1%;
          width: 51%;
          animation-delay: 160ms;
        }

        .pond {
          --enter-x: 26px;
          --enter-y: 22px;
          --settle-rotation: 4deg;
          right: 4%;
          bottom: 3%;
          width: 30%;
          animation-delay: 280ms;
        }

        .mango {
          --enter-x: -28px;
          --enter-y: -34px;
          --settle-rotation: -3deg;
          left: 3%;
          top: 4%;
          width: 31%;
          animation-delay: 400ms;
        }

        .tank {
          --enter-x: 36px;
          --enter-y: -25px;
          --settle-rotation: 2deg;
          right: 4%;
          top: 8%;
          width: 27%;
          animation-delay: 520ms;
        }

        .banana {
          --enter-x: 18px;
          --enter-y: -38px;
          --settle-rotation: 3deg;
          left: 34%;
          top: 18%;
          width: 31%;
          animation-delay: 640ms;
        }

        .coop {
          --enter-x: -34px;
          --enter-y: 8px;
          --settle-rotation: -2deg;
          left: 24%;
          bottom: 15%;
          width: 27%;
          animation-delay: 760ms;
        }

        .hive {
          --enter-x: 30px;
          --enter-y: -12px;
          --settle-rotation: 4deg;
          right: 24%;
          bottom: 18%;
          width: 19%;
          animation-delay: 880ms;
        }

        .spekboom {
          --enter-x: 24px;
          --enter-y: 20px;
          --settle-rotation: 2deg;
          right: 8%;
          top: 35%;
          width: 24%;
          animation-delay: 1000ms;
        }

        @keyframes gridIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes settle {
          0% {
            opacity: 0;
            transform: translate(var(--enter-x), var(--enter-y)) scale(0.76)
              rotate(calc(var(--settle-rotation) - 7deg));
          }
          72% {
            opacity: 1;
          }
          100% {
            opacity: 1;
            transform: translate(0, 0) scale(1) rotate(var(--settle-rotation));
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .plotGrid,
          .plotOutline,
          .piece {
            animation: none;
            opacity: 1;
          }

          .piece {
            transform: rotate(var(--settle-rotation));
          }
        }
      `}</style>
    </div>
  );
}
