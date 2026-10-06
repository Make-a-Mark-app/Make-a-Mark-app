import { useEffect, useId, useRef, useState } from "react";
import type { ImpactTotals } from "../shared/contracts/impact-totals";

const landPaths = [
  "M97 175l30-31 43-13 32 10 17 20 28-2 19 20-10 26-27 12-17 32-29 8-9 25-20 4-16-26-29-17-18-30z",
  "M205 277l28-13 27 12 15 27-6 39-18 32-14 36-23 27-20-15 4-35-16-31 10-32-13-25z",
  "M286 145l18-15 24 6 8 19-15 16-22-4z",
  "M292 194l32-16 27 12 20-8 19 19-10 26-27 6-9 25-24-1-11-21-25-11z",
  "M326 254l39-18 41 15 17 36-13 32-21 16-13 41-32 27-25-25-13-48-14-28 11-29z",
  "M367 157l38-20 51 11 44 33 17 42-23 22-34-12-27 14-19-16-28-2-14-34-27-8z",
  "M416 254l25-7 25 12 14 29-15 17-20-9-11-24z",
  "M432 375l29-17 34 13 13 33-21 25-44-6-24-22z",
  "M128 119l31-28 33 7-6 22-34 14z",
];

export function ShopGlobe({ totals }: { totals: ImpactTotals | null }) {
  const id = useId().replace(/:/g, "");
  const globeRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const green = Math.min(1, Math.sqrt((totals?.trees ?? 0) / 100));
  const blue = Math.min(1, Math.sqrt((totals?.waterDollars ?? 0) / 100));

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(globe);
    return () => observer.disconnect();
  }, []);

  const map = (offset: number) => (
    <g key={offset} transform={`translate(${offset} 0)`}>
      <g fill="#b3946c" stroke="#806b54" strokeWidth="2" strokeLinejoin="round">
        {landPaths.map((path, index) => <path key={index} d={path} />)}
      </g>
      <g fill={`url(#${id}-green)`} opacity={green}>
        {landPaths.map((path, index) => <path key={index} d={path} />)}
      </g>
    </g>
  );

  return (
    <div ref={globeRef} className={`shop-globe${visible ? " shop-globe-visible" : ""}`} role="img" aria-label="Illustrative planet that gains green land and blue water as demo exchanges increase">
      <svg viewBox="0 0 600 600" focusable="false" aria-hidden="true">
        <defs>
          <radialGradient id={`${id}-bare`} cx="34%" cy="27%" r="77%">
            <stop offset="0" stopColor="#c7ae85" />
            <stop offset=".62" stopColor="#927b61" />
            <stop offset="1" stopColor="#4a4b43" />
          </radialGradient>
          <radialGradient id={`${id}-water`} cx="34%" cy="26%" r="78%">
            <stop offset="0" stopColor="#59b7bd" />
            <stop offset=".55" stopColor="#127c87" />
            <stop offset="1" stopColor="#073e51" />
          </radialGradient>
          <linearGradient id={`${id}-green`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#d6e891" />
            <stop offset="1" stopColor="#6ba76b" />
          </linearGradient>
          <radialGradient id={`${id}-shade`} cx="31%" cy="25%" r="77%">
            <stop offset=".35" stopColor="#fff" stopOpacity=".11" />
            <stop offset=".68" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#091a17" stopOpacity=".73" />
          </radialGradient>
          <clipPath id={`${id}-clip`}><circle cx="300" cy="300" r="216" /></clipPath>
        </defs>
        <circle cx="300" cy="300" r="268" fill="none" stroke="#b8c8b5" strokeOpacity=".55" />
        <circle cx="300" cy="300" r="242" fill="none" stroke="#b8c8b5" strokeOpacity=".68" strokeDasharray="2 11" />
        <g clipPath={`url(#${id}-clip)`}>
          <circle cx="300" cy="300" r="216" fill={`url(#${id}-bare)`} />
          <circle cx="300" cy="300" r="216" fill={`url(#${id}-water)`} opacity={blue} />
          <g className="shop-globe-surface">{map(0)}{map(600)}</g>
          <g fill="none" stroke="#f3f3da" strokeOpacity=".22" strokeWidth="1.3">
            <ellipse cx="300" cy="300" rx="70" ry="216" />
            <ellipse cx="300" cy="300" rx="150" ry="216" />
            <path d="M84 300h432M100 220c104 42 296 42 400 0M100 380c104-42 296-42 400 0" />
          </g>
          <circle cx="300" cy="300" r="216" fill={`url(#${id}-shade)`} />
        </g>
        <circle cx="300" cy="300" r="216" fill="none" stroke="#e9ead1" strokeOpacity=".8" strokeWidth="2" />
        <circle cx="520" cy="184" r="5" fill="#d7e935" />
      </svg>
    </div>
  );
}

