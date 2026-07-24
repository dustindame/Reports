/* ===========================================================
   Shared inline SVG icons — Fantasy Auction Draft system
   Self-contained (no external icon font / CDN)
   =========================================================== */

const Icons = {
  football(size = 24, color = "currentColor") {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="12" cy="12" rx="10" ry="6.2" fill="${color}" transform="rotate(-38 12 12)"/>
      <g stroke="#f3f2ee" stroke-width="0.9" stroke-linecap="round" transform="rotate(-38 12 12)">
        <line x1="7.2" y1="12" x2="16.8" y2="12"/>
        <line x1="9.6" y1="10.2" x2="9.6" y2="13.8"/>
        <line x1="11.4" y1="10.2" x2="11.4" y2="13.8"/>
        <line x1="12.6" y1="10.2" x2="12.6" y2="13.8"/>
        <line x1="14.4" y1="10.2" x2="14.4" y2="13.8"/>
      </g>
    </svg>`;
  },

  pylon(size = 20, color = "#e8720c") {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 21 L12 4 L19 21 Z" fill="${color}"/>
      <path d="M5 21 L12 4 L12 21 Z" fill="rgba(0,0,0,0.18)"/>
    </svg>`;
  },

  search(size = 20, color = "#d4af37") {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10.5" cy="10.5" r="6.5" stroke="${color}" stroke-width="2"/>
      <line x1="15.3" y1="15.3" x2="21" y2="21" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
    </svg>`;
  },

  flag(size = 18, color = "#d4af37") {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="5" y1="3" x2="5" y2="21" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
      <path d="M5 4 L19 7 L5 11 Z" fill="${color}"/>
    </svg>`;
  },

  check(size = 16, color = "#2e7d32") {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="11" fill="${color}"/>
      <path d="M7 12.5 L10.3 16 L17 8.5" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  },

  clock(size = 18, color = "#d4af37") {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" stroke="${color}" stroke-width="1.6"/>
      <line x1="12" y1="12" x2="12" y2="7" stroke="${color}" stroke-width="1.6" stroke-linecap="round"/>
      <line x1="12" y1="12" x2="15.2" y2="13.6" stroke="${color}" stroke-width="1.6" stroke-linecap="round"/>
    </svg>`;
  },

  chevronLeft(size = 18, color = "#d4af37") {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 5 L8 12 L15 19" stroke="${color}" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  },

  chevronRight(size = 18, color = "#d4af37") {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 5 L16 12 L9 19" stroke="${color}" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  },

  gear(size = 20, color = "#d4af37") {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 8.4a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2Z" stroke="${color}" stroke-width="1.8"/>
      <path d="M12 2.8v2.1M12 19.1v2.1M21.2 12h-2.1M4.9 12H2.8M18.1 5.9l-1.5 1.5M7.4 16.6l-1.5 1.5M18.1 18.1l-1.5-1.5M7.4 7.4 5.9 5.9" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/>
    </svg>`;
  },

  /* Referee/commissioner whistle — used for links into Draft Setup instead
     of a gear, which at icon size read as a sun (circle + radiating spokes,
     no teeth) rather than a settings cog. */
  whistle(size = 20, color = "#d4af37") {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="9" cy="15" r="5.2" stroke="${color}" stroke-width="1.8"/>
      <circle cx="9" cy="15" r="1.4" fill="${color}"/>
      <path d="M9 9.8V7.2a1 1 0 0 1 1-1h7.2a2.6 2.6 0 0 1 0 5.2H13.4" stroke="${color}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  },

  helmet(size = 22, color = "#d4af37") {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3.5 13.5C3.5 8.3 7.6 4.5 12.5 4.5S21 8.6 21 13c0 2.8-1.6 4.3-4.3 4.3h-3.9" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M3.5 13.5c0 3.4 2 5.4 5 5.4h2.3" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M7.5 12.2c-1.9.5-3 1.9-3.2 3.8" stroke="${color}" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M7.8 13v5.4M10.6 12.5v6.4" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`;
  },

  goalPost(size = 22, color = "#d4af37") {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 3v7M18 3v7M6 10h12M12 10v11" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  },

  field(size = 22, color = "#4caf50") {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2.5" y="5" width="19" height="14" rx="1.5" stroke="${color}" stroke-width="1.6"/>
      <line x1="7" y1="5" x2="7" y2="19" stroke="${color}" stroke-width="1.2"/>
      <line x1="12" y1="5" x2="12" y2="19" stroke="${color}" stroke-width="1.4"/>
      <line x1="17" y1="5" x2="17" y2="19" stroke="${color}" stroke-width="1.2"/>
    </svg>`;
  },

  download(size = 18, color = "#d4af37") {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3v12M7.5 10.5 12 15l4.5-4.5" stroke="${color}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M5 19h14" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/>
    </svg>`;
  },

  camera(size = 18, color = "#d4af37") {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="7" width="18" height="13" rx="2.2" stroke="${color}" stroke-width="1.8"/>
      <path d="M8.2 7 9.5 4.6h5L15.8 7" stroke="${color}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="12" cy="13.6" r="3.3" stroke="${color}" stroke-width="1.8"/>
    </svg>`;
  },

  barChart(size = 18, color = "#d4af37") {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="12" width="4" height="8" rx="1" fill="${color}"/>
      <rect x="10" y="7" width="4" height="13" rx="1" fill="${color}"/>
      <rect x="16" y="3" width="4" height="17" rx="1" fill="${color}"/>
    </svg>`;
  },
};
