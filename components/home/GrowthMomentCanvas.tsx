'use client';

import { useCallback } from 'react';
import { Alignment, Fit, Layout, RuntimeLoader, useRive } from '@rive-app/react-canvas-lite';

RuntimeLoader.setWasmUrl('/rive/rive.wasm');

const layout = new Layout({ fit: Fit.Contain, alignment: Alignment.Center });

export default function GrowthMomentCanvas({ onReady }: { onReady: () => void }) {
  const handleLoad = useCallback(() => onReady(), [onReady]);
  const { RiveComponent } = useRive({
    src: '/rive/growth-moment.riv',
    artboard: 'Growth',
    stateMachine: 'Growth',
    autoplay: true,
    layout,
    onLoad: handleLoad,
    shouldDisableRiveListeners: true,
  });

  return <RiveComponent style={{ display: 'block', width: '100%', height: '100%' }} />;
}
