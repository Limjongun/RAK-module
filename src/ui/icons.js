// Helper ikon SVG konsisten sesuai panduan rak-modul-ui-guide.md
// Garis 1.75px, ujung bulat, viewBox 24, warna mengikuti teks (currentColor)

export function icon(name, extraClass = '') {
  const cls = `rm-icon ${extraClass}`.trim();
  switch (name) {
    case 'highlight':
      return `<svg class="${cls}" viewBox="0 0 24 24"><path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>`;
    case 'underline':
      return `<svg class="${cls}" viewBox="0 0 24 24"><path d="M6 4v6a6 6 0 0 0 12 0V4"/><path d="M4 20h16"/></svg>`;
    case 'strike':
      return `<svg class="${cls}" viewBox="0 0 24 24"><path d="M16 4H9a3 3 0 0 0-2.8 4"/><path d="M14 12a4 4 0 0 1 0 8H6"/><path d="M4 12h16"/></svg>`;
    case 'pen':
      return `<svg class="${cls}" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>`;
    case 'note':
      return `<svg class="${cls}" viewBox="0 0 24 24"><path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5z"/><path d="M15 3v6h6"/></svg>`;
    case 'eraser':
      return `<svg class="${cls}" viewBox="0 0 24 24"><path d="M7 21h10"/><path d="m5 14 8-8 6 6-7 7H9z"/></svg>`;
    case 'speaker':
      return `<svg class="${cls}" viewBox="0 0 24 24"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>`;
    case 'search':
      return `<svg class="${cls}" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>`;
    case 'play':
      return `<svg class="${cls}" viewBox="0 0 24 24"><polygon points="6 4 20 12 6 20 6 4" fill="currentColor" stroke="none"/></svg>`;
    case 'pause':
      return `<svg class="${cls}" viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor" stroke="none"/></svg>`;
    case 'prev':
      return `<svg class="${cls}" viewBox="0 0 24 24"><path d="m11 17-5-5 5-5"/><path d="m18 17-5-5 5-5"/></svg>`;
    case 'next':
      return `<svg class="${cls}" viewBox="0 0 24 24"><path d="m13 17 5-5-5-5"/><path d="m6 17 5-5-5-5"/></svg>`;
    case 'close':
      return `<svg class="${cls}" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>`;
    case 'trash':
      return `<svg class="${cls}" viewBox="0 0 24 24"><path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/></svg>`;
    case 'back':
      return `<svg class="${cls}" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>`;
    case 'upload':
      return `<svg class="${cls}" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`;
    case 'book':
      return `<svg class="${cls}" viewBox="0 0 24 24"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/></svg>`;
    case 'bookmark':
      return `<svg class="${cls}" viewBox="0 0 24 24"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>`;
    case 'sun':
      return `<svg class="${cls}" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`;
    case 'moon':
      return `<svg class="${cls}" viewBox="0 0 24 24"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;
    case 'sidebar':
      return `<svg class="${cls}" viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/></svg>`;
    case 'check':
      return `<svg class="${cls}" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`;
    case 'settings':
      return `<svg class="${cls}" viewBox="0 0 24 24"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`;
    case 'sliders':
      return `<svg class="${cls}" viewBox="0 0 24 24"><line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="1" x2="7" y1="14" y2="14"/><line x1="9" x2="15" y1="8" y2="8"/><line x1="17" x2="23" y1="16" y2="16"/></svg>`;
    case 'convert':
      return `<svg class="${cls}" viewBox="0 0 24 24"><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></svg>`;
    case 'cards':
      return `<svg class="${cls}" viewBox="0 0 24 24"><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M8 4h10a2 2 0 0 1 2 2v8"/><path d="M10 12h4"/></svg>`;
    case 'timer':
      return `<svg class="${cls}" viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 1.5"/><path d="m5 4-2 2M19 4l2 2M10 2h4"/></svg>`;
    case 'chart':
      return `<svg class="${cls}" viewBox="0 0 24 24"><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/><line x1="2" x2="22" y1="20" y2="20"/></svg>`;
    case 'flame':
      return `<svg class="${cls}" viewBox="0 0 24 24"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 17c1.38 0 2.5-1.12 2.5-2.5 0-.61-.22-1.17-.59-1.61L12 11.5l-.91 1.39c-.37.44-.59 1-.59 1.61z"/><path d="M12 2c1 3 4 5.5 4 9.5a6 6 0 1 1-12 0C4 8 7 5 9 3c.5 1.5 1.5 2.5 2 2.5.5 0 1-1 1-3.5z"/></svg>`;
    case 'rotate':
      return `<svg class="${cls}" viewBox="0 0 24 24"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>`;
    case 'plus':
      return `<svg class="${cls}" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
    case 'download':
      return `<svg class="${cls}" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>`;
    case 'code':
      return `<svg class="${cls}" viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`;
    case 'copy':
      return `<svg class="${cls}" viewBox="0 0 24 24"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
    case 'arrow-up':
      return `<svg class="${cls}" viewBox="0 0 24 24"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`;
    case 'arrow-down':
      return `<svg class="${cls}" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>`;
    case 'calendar':
      return `<svg class="${cls}" viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>`;
    case 'clock':
      return `<svg class="${cls}" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
    case 'check-circle':
      return `<svg class="${cls}" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
    case 'alert-triangle':
      return `<svg class="${cls}" viewBox="0 0 24 24"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>`;
    case 'list-todo':
      return `<svg class="${cls}" viewBox="0 0 24 24"><rect x="3" y="5" width="6" height="6" rx="1"/><path d="m3 17 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/></svg>`;
    case 'cloud':
      return `<svg class="${cls}" viewBox="0 0 24 24"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>`;
    case 'sync':
      return `<svg class="${cls}" viewBox="0 0 24 24"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>`;
    default:
      return `<svg class="${cls}" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>`;
  }
}

