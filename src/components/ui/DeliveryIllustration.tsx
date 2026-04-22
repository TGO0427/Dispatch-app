import React from "react";

const GREEN = "#52A547";
const GREEN_DARK = "#3F8A37";
const GREEN_LIGHT = "#A8D49B";

export const DeliveryIllustration: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 480 420"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="Delivery truck with packages on a dispatch route"
  >
    {/* Soft background blobs */}
    <circle cx="80" cy="90" r="60" fill={GREEN} opacity="0.08" />
    <circle cx="400" cy="140" r="80" fill={GREEN} opacity="0.06" />
    <circle cx="420" cy="300" r="50" fill={GREEN} opacity="0.1" />

    {/* Sun */}
    <circle cx="400" cy="80" r="28" fill="#FDE68A" opacity="0.7" />

    {/* Clouds */}
    <g fill="#ffffff" opacity="0.9">
      <ellipse cx="120" cy="70" rx="28" ry="10" />
      <ellipse cx="140" cy="64" rx="18" ry="8" />
      <ellipse cx="320" cy="110" rx="32" ry="10" />
      <ellipse cx="300" cy="104" rx="18" ry="8" />
    </g>

    {/* Route line (dashed, curved) */}
    <path
      d="M 40 340 Q 160 300 240 310 T 440 280"
      fill="none"
      stroke={GREEN}
      strokeWidth="2.5"
      strokeDasharray="6 6"
      opacity="0.6"
    />

    {/* Destination pin */}
    <g transform="translate(428, 258)">
      <circle r="14" fill={GREEN} />
      <circle r="5" fill="#ffffff" />
      <path d="M -10 10 L 0 28 L 10 10 Z" fill={GREEN} />
    </g>

    {/* Packages stack (left) */}
    <g transform="translate(60, 280)">
      <rect width="56" height="44" rx="3" fill="#D4A373" stroke="#8B6F47" strokeWidth="1.5" />
      <line x1="0" y1="22" x2="56" y2="22" stroke="#8B6F47" strokeWidth="1" opacity="0.5" />
      <line x1="28" y1="0" x2="28" y2="44" stroke="#8B6F47" strokeWidth="1" opacity="0.5" />
      <rect x="5" y="-42" width="48" height="42" rx="3" fill="#E6B98A" stroke="#8B6F47" strokeWidth="1.5" />
      <line x1="5" y1="-21" x2="53" y2="-21" stroke="#8B6F47" strokeWidth="1" opacity="0.5" />
    </g>

    {/* Ground / road */}
    <rect x="0" y="352" width="480" height="68" fill="#E7E5E4" />
    <line
      x1="0"
      y1="386"
      x2="480"
      y2="386"
      stroke="#ffffff"
      strokeWidth="3"
      strokeDasharray="18 14"
    />

    {/* Truck body */}
    <g>
      {/* Cargo area */}
      <rect x="160" y="232" width="150" height="108" rx="6" fill={GREEN} />
      <rect x="172" y="246" width="126" height="80" rx="3" fill="#ffffff" opacity="0.15" />
      {/* Side vents */}
      <rect x="175" y="250" width="2" height="72" fill="#ffffff" opacity="0.3" />
      <rect x="182" y="250" width="2" height="72" fill="#ffffff" opacity="0.3" />
      <rect x="189" y="250" width="2" height="72" fill="#ffffff" opacity="0.3" />
      {/* Door line */}
      <line x1="235" y1="232" x2="235" y2="340" stroke={GREEN_DARK} strokeWidth="2" />
      {/* Logo badge on cargo */}
      <circle cx="270" cy="282" r="18" fill="#ffffff" opacity="0.95" />
      <path
        d="M 262 280 Q 270 268 278 280 Q 270 292 262 280 Z"
        fill={GREEN}
      />

      {/* Cab */}
      <path
        d="M 310 260 L 360 260 Q 382 260 384 284 L 384 340 L 310 340 Z"
        fill={GREEN_DARK}
      />
      {/* Windshield */}
      <path
        d="M 318 270 L 356 270 Q 368 270 370 286 L 370 298 L 318 298 Z"
        fill="#BAE1B0"
      />
      <path
        d="M 318 270 L 356 270 Q 368 270 370 286 L 370 298 L 318 298 Z"
        fill="url(#glass)"
        opacity="0.4"
      />
      {/* Headlight */}
      <rect x="378" y="318" width="8" height="8" rx="1" fill="#FDE68A" />
      {/* Grill */}
      <rect x="372" y="304" width="14" height="4" rx="1" fill="#1f2937" opacity="0.4" />

      {/* Wheels */}
      <g>
        <circle cx="195" cy="350" r="22" fill="#1f2937" />
        <circle cx="195" cy="350" r="10" fill="#6b7280" />
        <circle cx="195" cy="350" r="4" fill="#1f2937" />

        <circle cx="340" cy="350" r="22" fill="#1f2937" />
        <circle cx="340" cy="350" r="10" fill="#6b7280" />
        <circle cx="340" cy="350" r="4" fill="#1f2937" />
      </g>

      {/* Motion lines behind truck */}
      <g stroke={GREEN} strokeWidth="3" strokeLinecap="round" opacity="0.5">
        <line x1="130" y1="260" x2="150" y2="260" />
        <line x1="122" y1="280" x2="146" y2="280" />
        <line x1="134" y1="300" x2="150" y2="300" />
      </g>
    </g>

    {/* Glass gradient definition */}
    <defs>
      <linearGradient id="glass" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.6" />
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>
    </defs>

    {/* Tiny accent dots (stars/sparkle) */}
    <g fill={GREEN_LIGHT}>
      <circle cx="60" cy="180" r="3" />
      <circle cx="90" cy="200" r="2" />
      <circle cx="440" cy="200" r="3" />
      <circle cx="410" cy="220" r="2" />
    </g>
  </svg>
);
