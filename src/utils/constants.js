// Constants for accessibility audit

// Visual styles
export const VISUAL_FEEDBACK = {
  BORDER: {
    ERROR_WIDTH: "5px",
    ERROR_COLOR: "#ef4444",
    OUTLINE_WIDTH: "5px",
    OUTLINE_COLOR: "#cc0808",
    OUTLINE_OFFSET: "3px",
  },
  BOX_SHADOW: {
    ERROR: "0 0 20px rgba(239, 68, 68, 0.6)",
  },
  ANIMATION: {
    PULSE_DURATION: "2s",
  },
};

// Accessibility badges
export const BADGE = {
  Z_INDEX: 999999,
  POSITION: {
    TOP: "5px",
    LEFT: "5px",
  },
  PADDING: "4px 8px",
  BORDER_RADIUS: "4px",
  FONT_SIZE: "11px",
  COLORS: {
    ERROR: "#dc2626",
    WARNING: "#f97316",
  },
};

// Delays and timeouts
export const TIMEOUTS = {
  FEEDBACK_MESSAGE: 2000, // 2 seconds
  SCROLL_DELAY: 100,
};

// Z-index for overlays
export const Z_INDEX = {
  BADGE: 999999,
  OVERLAY: 10000,
};

// Scores and thresholds
export const SCORES = {
  PERFECT: 100,
  GOOD_THRESHOLD: 80,
  MEDIUM_THRESHOLD: 60,
};

// Maximum complexity
export const COMPLEXITY = {
  MAX_FUNCTION: 10,
};

// Message texts
export const MESSAGES = {
  IMAGES: {
    MISSING_ALT: "⚠️ ALT MANQUANT",
  },
  LINKS: {
    EMPTY_LINK: "⚠️ LIEN VIDE",
  },
  SVG: {
    MISSING_ROLE: "⚠️ SVG NON ACCESSIBLE",
  },
  BUTTONS: {
    NO_LABEL: "⚠️ BOUTON SANS LABEL",
  },
};

// Category names
export const CATEGORY_NAMES = {
  images: "Image",
  svg: "SVG",
  links: "Lien",
  headings: "Titre",
  forms: "Formulaire",
  structure: "Structure",
  buttons: "Bouton",
};

// Priority emojis
export const PRIORITY_EMOJIS = {
  élevée: "🔴",
  moyenne: "🟡",
  faible: "🔵",
};

// Landmarks ARIA
export const LANDMARKS = {
  COUNT: 2,
  REQUIRED: ["main", "nav"],
};

// CSS selectors
export const SELECTORS = {
  ACCESSIBILITY_BADGES:
    ".accessibility-badge, .accessibility-badge-link, .accessibility-badge-svg, .accessibility-badge-button",
  MARKED_ELEMENTS: "[data-accessibility-issue]",
  POSITION_CHANGED: "[data-position-changed]",
};

// Injected style IDs
export const STYLE_IDS = {
  ANIMATION: "accessibility-animation-styles",
  BADGE_LINK: "accessibility-badge-link-styles",
  BADGE_SVG: "accessibility-badge-svg-styles",
  BADGE_BUTTON: "accessibility-button-styles",
};
