'use client';

import { useCallback, useEffect } from 'react';
import {
  Alignment,
  Fit,
  Layout,
  RuntimeLoader,
  useRive,
  useStateMachineInput,
} from '@rive-app/react-canvas-lite';

// The field app can be used with patchy connectivity, so the runtime stays on our origin.
RuntimeLoader.setWasmUrl('/rive/rive.wasm');

const layout = new Layout({ fit: Fit.Contain, alignment: Alignment.Center });

export default function RiveProgressSprout({
  stage,
  waveToken,
  onReady,
}: {
  stage: number;
  waveToken: number;
  onReady: () => void;
}) {
  const handleLoad = useCallback(() => onReady(), [onReady]);
  const { RiveComponent, rive } = useRive({
    src: '/rive/progress-sprout.riv',
    artboard: `Stage${stage}`,
    stateMachine: 'Motion',
    autoplay: true,
    layout,
    onLoad: handleLoad,
    shouldDisableRiveListeners: true,
  });
  const wave = useStateMachineInput(rive, 'Motion', 'Wave');

  useEffect(() => {
    if (waveToken > 0) wave?.fire();
  }, [wave, waveToken]);

  return (
    <span aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'block' }}>
      <RiveComponent style={{ display: 'block', width: '100%', height: '100%' }} />
    </span>
  );
}
