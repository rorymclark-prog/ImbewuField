'use client';

import { useState } from 'react';
import styles from './MappingExplainer.module.css';

const LAYERS = [
  { name: 'Place pin', heading: 'Where is the site?', text: 'The pin marks a location. It has no growing area of its own.' },
  { name: 'Land boundary', heading: 'Which land does the outline include?', text: 'The boundary surrounds the parcel. It can include a house, paths and unplanted ground.' },
  { name: 'Growing beds', heading: 'Where will the crop grow?', text: 'The beds occupy part of this example parcel. Check their measurements and the site used by the crop plan and financial forecast.' },
] as const;

export default function MappingExplainer() {
  const [layer, setLayer] = useState(0);
  return <section className={styles.explainer} aria-labelledby="map-example-title">
    <div className={styles.intro}>
      <p className={styles.eyebrow}>Explore the difference</p>
      <h2 id="map-example-title">One place. Three different records.</h2>
      <p>Choose a layer to see what it describes.</p>
    </div>
    <div className={styles.switches} role="group" aria-label="Illustration layer">
      {LAYERS.map((item, index) => <button key={item.name} type="button" aria-pressed={index === layer} onClick={() => setLayer(index)}>{item.name}</button>)}
    </div>
    <div className={styles.scene}>
      <svg viewBox="0 0 720 410" role="img" aria-labelledby="map-example-svg-title map-example-svg-description">
        <title id="map-example-svg-title">{`${LAYERS[layer].name} in a schematic homestead`}</title>
        <desc id="map-example-svg-description">A place pin sits beside a house. A four-corner boundary surrounds the house, paths, trees and four vegetable beds. The beds fill only part of the parcel. This illustration is not to scale and has no measured area.</desc>
        <rect width="720" height="410" rx="20" fill="#eee9d9" />
        <g fill="none" stroke="#dbd6c5" strokeWidth="1.5">
          <path d="M0 80 Q200 10 375 75 T720 40 M0 112 Q200 42 375 107 T720 72 M0 335 Q220 260 380 320 T720 330 M0 367 Q220 292 380 352 T720 362" />
        </g>
        <path d="M80 80 L604 58 L655 325 L94 351 Z" fill="#e1e7ce" stroke="#b1bf9e" strokeWidth="2" />
        <path d="M145 409 L175 315 Q204 291 237 265 L274 207" fill="none" stroke="#d1bb92" strokeWidth="24" />
        <path d="M249 246 Q340 254 437 257 L458 318" fill="none" stroke="#d1bb92" strokeWidth="13" />
        <g transform="translate(157 131)">
          <rect x="7" y="18" width="123" height="90" rx="3" fill="#d9c79e" />
          <path d="M-6 27 L67 -4 L141 27 L128 47 L67 22 L8 47 Z" fill="#807e6b" />
          <rect x="53" y="63" width="26" height="45" fill="#78634a" />
          <rect x="18" y="59" width="23" height="22" fill="#7e9290" />
          <rect x="92" y="59" width="23" height="22" fill="#7e9290" />
        </g>
        <g fill="#97ac78" stroke="#7c9663" strokeWidth="2">
          <circle cx="124" cy="114" r="23" /><circle cx="579" cy="117" r="26" /><circle cx="594" cy="278" r="23" />
        </g>
        <g className={styles.beds} data-active={layer === 2}>
          {[0, 1, 2, 3].map(i => <g key={i} transform={`translate(354 ${111 + i * 43})`}>
            <rect x="-5" y="-5" width="188" height="38" rx="8" fill={layer === 2 ? '#fffaf0' : 'transparent'} />
            <rect width="178" height="28" rx="5" fill="#987650" stroke={layer === 2 ? '#234e34' : '#795e40'} strokeWidth={layer === 2 ? 3 : 1} />
            {[0, 1, 2, 3, 4, 5, 6, 7].map(j => <g key={j} transform={`translate(${12 + j * 22} 14)`}>
              <ellipse rx="6" ry="9" transform="rotate(-35)" fill="#5c8250" />
              <ellipse rx="6" ry="9" transform="rotate(35)" fill="#789956" />
            </g>)}
          </g>)}
        </g>
        <path className={styles.boundary} data-active={layer === 1} d="M80 80 L604 58 L655 325 L94 351 Z" fill="none" stroke="#956b2c" strokeWidth="5" pathLength="1" />
        {[[80,80],[604,58],[655,325],[94,351]].map(([x,y]) => <circle key={`${x}-${y}`} className={styles.corner} data-active={layer === 1} cx={x} cy={y} r="7" fill="#fffdf6" stroke="#956b2c" strokeWidth="3" />)}
        <g className={styles.pin} data-active={layer === 0} transform="translate(301 164)">
          <ellipse cy="32" rx="20" ry="7" fill="#64754b" opacity=".25" />
          <path d="M0 31 C-8 18 -23 4 -23 -9 A23 23 0 1 1 23 -9 C23 4 8 18 0 31Z" fill="#245436" stroke="#fffdf6" strokeWidth="3" />
          <circle cy="-9" r="7" fill="#fffdf6" />
        </g>
        <g fill="#334a36" fontFamily="system-ui, sans-serif" fontSize="17" fontWeight="600">
          <text x="178" y="280">House</text><text x="369" y="322">Growing beds</text>
        </g>
      </svg>
      <p className={styles.caption}>Teaching illustration · not to scale · no measured area</p>
    </div>
    <div className={styles.explanation} aria-live="polite" aria-atomic="true">
      <h3>{LAYERS[layer].heading}</h3><p>{LAYERS[layer].text}</p>
    </div>
  </section>;
}
