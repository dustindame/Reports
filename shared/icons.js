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

  /* Decorative QR-style code (not a real scannable payload — static
     mockup stand-in for the link to the Team Picks page). Deterministic
     module pattern with QR-style finder squares in the corners. */
  qrCode(size = 96, seed = 42) {
    const grid = 21;
    const cell = size / grid;
    let s = seed;
    const rand = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return (s % 1000) / 1000;
    };
    const isFinder = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= grid - 7) || (r >= grid - 7 && c < 7);
    let modules = "";
    for (let r = 0; r < grid; r++) {
      for (let c = 0; c < grid; c++) {
        if (isFinder(r, c)) continue;
        if (rand() > 0.55) {
          modules += `<rect x="${c * cell}" y="${r * cell}" width="${cell * 0.92}" height="${cell * 0.92}" fill="#0a0a0d"/>`;
        }
      }
    }
    const finder = (fr, fc) => `
      <rect x="${fc * cell}" y="${fr * cell}" width="${cell * 7}" height="${cell * 7}" fill="#0a0a0d"/>
      <rect x="${(fc + 1) * cell}" y="${(fr + 1) * cell}" width="${cell * 5}" height="${cell * 5}" fill="#fff"/>
      <rect x="${(fc + 2) * cell}" y="${(fr + 2) * cell}" width="${cell * 3}" height="${cell * 3}" fill="#0a0a0d"/>
    `;
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="QR code">
      <rect width="${size}" height="${size}" fill="#fff" rx="6"/>
      ${modules}
      ${finder(0, 0)}
      ${finder(0, grid - 7)}
      ${finder(grid - 7, 0)}
    </svg>`;
  },
};
