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

  // Filled cog silhouette with chunky trapezoidal teeth (not thin
  // spoke lines) -- the old stroke-based version below read as a sun
  // at small icon sizes since the teeth had no real width.
  gear(size = 20, color = "#d4af37") {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" xmlns="http://www.w3.org/2000/svg">
      <path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.53,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.72,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.22,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.22,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.72,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.53,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.68 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z"/>
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

  helpCircle(size = 20, color = "#d4af37") {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9.2" stroke="${color}" stroke-width="1.8"/>
      <path d="M9.6 9.3a2.4 2.4 0 1 1 3.9 1.9c-.9.7-1.5 1.2-1.5 2.3" stroke="${color}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="12" cy="17" r="1.15" fill="${color}"/>
    </svg>`;
  },

  megaphone(size = 20, color = "#d4af37") {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 10.2v3.6a1 1 0 0 0 1 1h1.6l4.6 3V6.2l-4.6 3H4a1 1 0 0 0-1 1Z" fill="${color}"/>
      <path d="M14.4 8.1c1.6 1.1 1.6 6.7 0 7.8" stroke="${color}" stroke-width="1.7" stroke-linecap="round" fill="none"/>
      <path d="M17.3 6c2.7 2.1 2.7 9.9 0 12" stroke="${color}" stroke-width="1.7" stroke-linecap="round" fill="none" opacity="0.6"/>
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
