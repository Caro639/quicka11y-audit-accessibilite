// Content script to analyze page accessibility

// Protection contre les injections multiples du script
if (window.accessibilityAuditInjected) {
  // Ne pas continuer l'exécution du script
  throw new Error("Script already injected");
}
window.accessibilityAuditInjected = true;

// Store marked elements for later modification
const markedElements = {
  images: [],
  svgs: [],
  links: [],
  headings: [],
  forms: [],
  buttons: [],
  contrast: [],
};

// Constantes NodeFilter
const NODE_FILTER_SHOW_TEXT = 4;
const NODE_FILTER_ACCEPT = 1;
const NODE_FILTER_REJECT = 2;

// Durée de l'effet de mise en évidence (en ms)
const HIGHLIGHT_DURATION = 3000;

// ============= CONSTANTES POUR LE CALCUL DE CONTRASTE =============

// Constantes pour la conversion RGB → Luminance relative (norme sRGB)
const RGB_MAX_VALUE = 255; // Valeur maximale d'une composante RGB (0-255)
const SRGB_THRESHOLD = 0.03928; // Seuil de linéarisation sRGB
const SRGB_LINEAR_DIVISOR = 12.92; // Diviseur pour la partie linéaire
const SRGB_OFFSET = 0.055; // Offset pour la partie non-linéaire
const SRGB_GAMMA_DIVISOR = 1.055; // Diviseur pour le gamma
const SRGB_GAMMA_EXPONENT = 2.4; // Exposant gamma

// Coefficients de luminance relative (norme ITU-R BT.709)
const LUMINANCE_RED_COEFFICIENT = 0.2126; // Coefficient rouge
const LUMINANCE_GREEN_COEFFICIENT = 0.7152; // Coefficient vert
const LUMINANCE_BLUE_COEFFICIENT = 0.0722; // Coefficient bleu

// Constantes pour le calcul du ratio de contraste WCAG
const CONTRAST_OFFSET = 0.05; // Offset WCAG pour le calcul du ratio

// Constantes pour l'analyse des couleurs hexadécimales
const HEX_SHORT_LENGTH = 3; // Longueur d'un hex court (#RGB)
const HEX_BLUE_START_INDEX = 4; // Position du bleu dans hex long (#RRGGBB)
const HEX_COMPONENT_LENGTH = 2; // Longueur d'une composante hex (RR, GG, BB)
const HEX_RADIX = 16; // Base hexadécimale

// Constantes pour la détection du texte large (WCAG 2.1)
const LARGE_TEXT_MIN_SIZE = 24; // Taille minimale en px pour texte large
const LARGE_TEXT_MIN_SIZE_BOLD = 18.66; // Taille minimale en px pour texte large gras
const BOLD_FONT_WEIGHT_THRESHOLD = 700; // Poids minimum pour considérer comme gras

// Ratios de contraste minimum selon WCAG 2.1 AA
const CONTRAST_RATIO_NORMAL_TEXT = 4.5; // Ratio minimum pour texte normal
const CONTRAST_RATIO_LARGE_TEXT = 3; // Ratio minimum pour texte large

// Constantes pour la détection du texte direct
const TEXT_NODE_TYPE = 3; // Type de noeud pour les text nodes (Node.TEXT_NODE)

// Limite de performance pour l'analyse du contraste
const MAX_CONTRAST_ELEMENTS = 500; // Nombre maximum d'éléments à analyser (augmenté pour pages complexes)

// Constante pour la longueur maximale des snippets HTML
const MAX_HTML_SNIPPET_LENGTH = 500; // Nombre maximum de caractères pour un snippet HTML

// ============= FONCTION UTILITAIRE POUR LES SNIPPETS HTML =============

/**
 * Génère un extrait de code HTML propre pour un élément
 * @param {HTMLElement} element - L'élément DOM à extraire
 * @returns {string} - Snippet HTML nettoyé et tronqué si nécessaire
 */
function generateHTMLSnippet(element) {
  if (!element || !element.outerHTML) {
    return "";
  }

  // Cloner l'élément pour ne pas modifier l'original
  const clone = element.cloneNode(true);

  // Supprimer les attributs ajoutés par notre extension
  clone.removeAttribute("data-accessibility-id");
  clone.removeAttribute("data-accessibility-issue");
  clone.removeAttribute("data-position-changed");

  // Supprimer aussi les styles ajoutés par notre extension
  clone.style.outline = "";
  clone.style.outlineOffset = "";
  clone.style.boxShadow = "";
  clone.style.border = "";
  clone.style.animation = "";

  // Supprimer les badges d'accessibilité du clone
  const badges = clone.querySelectorAll('[class*="accessibility-badge"]');
  badges.forEach((badge) => badge.remove());

  let html = clone.outerHTML;

  // Tronquer si trop long
  if (html.length > MAX_HTML_SNIPPET_LENGTH) {
    html = `${html.substring(0, MAX_HTML_SNIPPET_LENGTH)}...`;
  }

  return html;
}

// Main audit function
function auditAccessibility() {
  // Nettoyer les marqueurs de l'audit précédent pour éviter les doublons
  clearVisualFeedback();

  // Reset arrays
  markedElements.images = [];
  markedElements.svgs = [];
  markedElements.links = [];
  markedElements.headings = [];
  markedElements.forms = [];
  markedElements.buttons = [];
  markedElements.contrast = [];

  const results = {
    images: checkImages(),
    svg: checkSVG(),
    links: checkLinks(),
    headings: checkHeadings(),
    forms: checkForms(),
    contrast: checkContrast(),
    colorblind: { total: 0, issues: [], passed: 0 },
    lang: checkLanguage(),
    landmarks: checkLandmarks(),
    buttons: checkButtons(),
  };

  return results;
}

// ============= FONCTIONS UTILITAIRES POUR LE CONTRASTE =============

/**
 * Convertit une composante de couleur sRGB en luminance relative
 * @param {number} colorValue - Valeur de la composante (0-255)
 * @returns {number} - Luminance relative
 */
function getRGBLuminance(colorValue) {
  const val = colorValue / RGB_MAX_VALUE;
  return val <= SRGB_THRESHOLD
    ? val / SRGB_LINEAR_DIVISOR
    : Math.pow((val + SRGB_OFFSET) / SRGB_GAMMA_DIVISOR, SRGB_GAMMA_EXPONENT);
}

/**
 * Calcule la luminance relative d'une couleur RGB
 * @param {number} r - Rouge (0-255)
 * @param {number} g - Vert (0-255)
 * @param {number} b - Bleu (0-255)
 * @returns {number} - Luminance relative (0-1)
 */
function getRelativeLuminance(r, g, b) {
  const rLum = getRGBLuminance(r);
  const gLum = getRGBLuminance(g);
  const bLum = getRGBLuminance(b);
  return (
    LUMINANCE_RED_COEFFICIENT * rLum +
    LUMINANCE_GREEN_COEFFICIENT * gLum +
    LUMINANCE_BLUE_COEFFICIENT * bLum
  );
}

/**
 * Parse une couleur CSS et retourne les composantes RGB
 * @param {string} color - Couleur CSS (rgb, rgba, hex)
 * @returns {Object|null} - {r, g, b, a} ou null si invalide
 */
function parseColor(color) {
  if (!color || color === "transparent") {
    return null;
  }

  // RGB ou RGBA
  const rgbMatch = color.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/,
  );
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1]),
      g: parseInt(rgbMatch[2]),
      b: parseInt(rgbMatch[3]),
      a: rgbMatch[4] ? parseFloat(rgbMatch[4]) : 1,
    };
  }

  // Hex
  const hexMatch = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === HEX_SHORT_LENGTH) {
      hex = hex
        .split("")
        .map((c) => c + c)
        .join("");
    }
    return {
      r: parseInt(hex.slice(0, HEX_COMPONENT_LENGTH), HEX_RADIX),
      g: parseInt(
        hex.slice(HEX_COMPONENT_LENGTH, HEX_COMPONENT_LENGTH * 2),
        HEX_RADIX,
      ),
      b: parseInt(
        hex.slice(
          HEX_BLUE_START_INDEX,
          HEX_BLUE_START_INDEX + HEX_COMPONENT_LENGTH,
        ),
        HEX_RADIX,
      ),
      a: 1,
    };
  }

  // Couleurs nommées simples
  const colorMap = {
    white: { r: 255, g: 255, b: 255, a: 1 },
    black: { r: 0, g: 0, b: 0, a: 1 },
    red: { r: 255, g: 0, b: 0, a: 1 },
    green: { r: 0, g: 128, b: 0, a: 1 },
    blue: { r: 0, g: 0, b: 255, a: 1 },
  };

  return colorMap[color.toLowerCase()] || null;
}

/**
 * Calcule le ratio de contraste entre deux couleurs selon WCAG 2.1
 * @param {string} fgColor - Couleur du texte
 * @param {string} bgColor - Couleur du fond
 * @returns {number} - Ratio de contraste (1-21)
 */
function calculateContrastRatio(fgColor, bgColor) {
  const fg = parseColor(fgColor);
  const bg = parseColor(bgColor);

  if (!fg || !bg) {
    return 0;
  }

  const fgLum = getRelativeLuminance(fg.r, fg.g, fg.b);
  const bgLum = getRelativeLuminance(bg.r, bg.g, bg.b);

  const lighter = Math.max(fgLum, bgLum);
  const darker = Math.min(fgLum, bgLum);

  return (lighter + CONTRAST_OFFSET) / (darker + CONTRAST_OFFSET);
}

/**
 * Détermine si un texte est considéré comme "grand" selon WCAG
 * @param {number} fontSize - Taille de la police en pixels
 * @param {string} fontWeight - Poids de la police
 * @returns {boolean}
 */
function isLargeText(fontSize, fontWeight) {
  const isBold =
    fontWeight === "bold" || parseInt(fontWeight) >= BOLD_FONT_WEIGHT_THRESHOLD;
  return (
    fontSize >= LARGE_TEXT_MIN_SIZE ||
    (fontSize >= LARGE_TEXT_MIN_SIZE_BOLD && isBold)
  );
}

/**
 * Vérifie si un élément a du texte direct (pas dans les enfants)
 * Retourne true uniquement si l'élément a des text nodes directs
 * @param {HTMLElement} element - L'élément à vérifier
 * @returns {boolean}
 */
function hasDirectTextContent(element) {
  // Parcourir les childNodes directs
  for (const node of element.childNodes) {
    // Si c'est un text node (nodeType TEXT_NODE_TYPE) avec du contenu non vide
    if (
      node.nodeType === TEXT_NODE_TYPE &&
      node.textContent.trim().length > 0
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Traite un élément pour vérifier le contraste et créer les marqueurs visuels
 * @param {HTMLElement} el - L'élément à vérifier
 * @param {number} issueIndex - Index de l'erreur
 * @returns {Object|null} - Objet représentant l'erreur ou null si aucun problème
 */
function processContrastElement(el, issueIndex) {
  const style = window.getComputedStyle(el);
  const fgColor = style.color;
  const bgColor = style.backgroundColor;

  // Skip si fond transparent (nécessiterait calcul complexe avec parents)
  if (!bgColor || bgColor === "transparent" || bgColor === "rgba(0, 0, 0, 0)") {
    return null;
  }

  const bg = parseColor(bgColor);
  // Skip si fond semi-transparent (trop complexe)
  if (bg && bg.a < 1) {
    return null;
  }

  const ratio = calculateContrastRatio(fgColor, bgColor);
  const fontSize = parseFloat(style.fontSize);
  const fontWeight = style.fontWeight;
  const largeText = isLargeText(fontSize, fontWeight);

  // Ratio minimum selon WCAG 2.1 AA
  const minimumRatio = largeText
    ? CONTRAST_RATIO_LARGE_TEXT
    : CONTRAST_RATIO_NORMAL_TEXT;

  if (ratio > 0 && ratio < minimumRatio) {
    const contrastId = `accessibility-contrast-${issueIndex}`;
    el.setAttribute("data-accessibility-id", contrastId);
    el.setAttribute("data-accessibility-issue", "low-contrast");

    // Ajouter bordure violet foncé
    el.style.outline = "3px solid #6b21a8";
    el.style.outlineOffset = "2px";
    el.style.boxShadow = "0 0 15px rgba(107, 33, 168, 0.5)";

    // Stocker l'élément
    markedElements.contrast.push(el);

    // Créer et ajouter un badge violet foncé
    createContrastBadge(el, contrastId);

    // Ajouter les styles nécessaires
    ensureContrastStyles();

    return {
      element: `${el.tagName.toLowerCase()} ${issueIndex + 1}`,
      issue: `Contraste insuffisant (${ratio.toFixed(2)}:1 < ${minimumRatio}:1)`,
      explanation: largeText
        ? "Pour du texte large, le ratio minimum est 3:1 (WCAG AA)."
        : "Pour du texte normal, le ratio minimum est 4.5:1 (WCAG AA).",
      severity: "élevée",
      ratio: ratio.toFixed(2),
      required: minimumRatio,
      fgColor: fgColor,
      bgColor: bgColor,
      fontSize: `${fontSize.toFixed(1)}px`,
      contrastId: contrastId,
      htmlSnippet: generateHTMLSnippet(el),
    };
  }

  return null;
}

/**
 * S'assure que les styles pour les badges de contraste sont présents
 */
function ensureContrastStyles() {
  // Ajouter le style d'animation si pas encore présent
  if (!document.getElementById("accessibility-animation-styles")) {
    const style = document.createElement("style");
    style.id = "accessibility-animation-styles";
    style.textContent = `
      @keyframes pulse-red {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }
    `;
    document.head.appendChild(style);
  }

  // Ajouter le style du badge contrast si pas encore présent
  if (!document.getElementById("accessibility-contrast-badge-style")) {
    const badgeStyle = document.createElement("style");
    badgeStyle.id = "accessibility-contrast-badge-style";
    badgeStyle.textContent = `
      .accessibility-badge-contrast {
        position: absolute;
        top: 0;
        left: 0;
        background: #6b21a8;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: bold;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        z-index: 999999;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        pointer-events: none;
        animation: pulse-red 2s infinite;
        white-space: nowrap;
      }
    `;
    document.head.appendChild(badgeStyle);
  }
}

/**
 * Vérifie le contraste des couleurs (texte sur fond uni uniquement)
 * Limite à MAX_CONTRAST_ELEMENTS (500) éléments pour les performances
 */
function checkContrast() {
  // Sélectionner tous les éléments textuels pertinents
  const allElements = Array.from(
    document.querySelectorAll(
      "p, h1, h2, h3, h4, h5, h6, a, button, span, li, td, th, label",
    ),
  ).filter((el) => {
    // Ignorer les éléments cachés
    const style = window.getComputedStyle(el);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.opacity === "0"
    ) {
      return false;
    }

    // Pour les éléments interactifs (button, a, label), accepter tout texte visible
    const isInteractive = ["BUTTON", "A", "LABEL"].includes(el.tagName);

    if (isInteractive) {
      return el.textContent.trim().length > 0;
    }

    // Pour les autres éléments, vérifier qu'il y a du texte direct
    return hasDirectTextContent(el);
  });

  // Prioriser les éléments interactifs (button, a, label) car plus critiques pour l'accessibilité
  const interactiveElements = allElements.filter((el) =>
    ["BUTTON", "A", "LABEL"].includes(el.tagName),
  );
  const otherElements = allElements.filter(
    (el) => !["BUTTON", "A", "LABEL"].includes(el.tagName),
  );

  // Combiner : interactifs d'abord, puis les autres, puis limiter à MAX_CONTRAST_ELEMENTS
  const textElements = [...interactiveElements, ...otherElements].slice(
    0,
    MAX_CONTRAST_ELEMENTS,
  );

  const issues = [];
  let issueIndex = 0;

  textElements.forEach((el) => {
    const issue = processContrastElement(el, issueIndex);
    if (issue) {
      issues.push(issue);
      issueIndex++;
    }
  });

  return {
    total: textElements.length,
    issues: issues,
    passed: textElements.length - issues.length,
    disclaimer:
      'Contraste analysé pour texte sur fonds unis uniquement. Les dégradés, filtres et transparences nécessitent une vérification manuelle. <a href="https://webaim.org/resources/contrastchecker/" target="_blank" rel="noopener noreferrer">Tester avec l\'outil WebAIM →</a>',
  };
}

/**
 * Créer un badge pour un élément avec problème de contraste
 */
function createContrastBadge(element, contrastId) {
  if (
    element.parentElement.querySelector(
      `.accessibility-badge-contrast[data-badge-for="${contrastId}"]`,
    )
  ) {
    return; // Badge déjà présent
  }

  const badge = document.createElement("div");
  badge.className = "accessibility-badge-contrast";
  badge.textContent = "⚠️ CONTRASTE FAIBLE";
  badge.setAttribute("data-badge-for", contrastId);

  // S'assurer que le parent a position: relative
  const parent = element.parentElement;
  const originalPosition = window.getComputedStyle(parent).position;
  if (originalPosition === "static") {
    parent.style.position = "relative";
    parent.setAttribute("data-position-changed", "true");
  }

  parent.appendChild(badge);
}

// Check images without alt text
function checkImages() {
  const images = document.querySelectorAll("img");
  const issues = [];

  images.forEach((img, index) => {
    if (!img.alt || img.alt.trim() === "") {
      // Add unique ID for navigation
      const imageId = `accessibility-img-${index}`;
      img.setAttribute("data-accessibility-id", imageId);

      // Add red border with animation
      img.style.border = "5px solid #ef4444";
      img.style.outline = "5px solid #cc0808";
      img.style.outlineOffset = "3px";
      img.style.boxShadow = "0 0 20px rgba(239, 68, 68, 0.6)";
      img.style.animation = "pulse-red 2s infinite";
      img.setAttribute("data-accessibility-issue", "missing-alt");

      // Store l'élément pour pouvoir le modifier plus tard
      markedElements.images.push(img);

      // Créer et ajouter un badge visuel
      if (!img.parentElement.querySelector(".accessibility-badge")) {
        const badge = document.createElement("div");
        badge.className = "accessibility-badge";
        badge.textContent = "⚠️ ALT MANQUANT";
        badge.setAttribute("data-badge-for", imageId);

        // Position badge
        const imgParent = img.parentElement;
        const originalPosition = window.getComputedStyle(imgParent).position;
        if (originalPosition === "static") {
          imgParent.style.position = "relative";
          imgParent.setAttribute("data-position-changed", "true");
        }

        imgParent.appendChild(badge);
      }

      // Add CSS animation si elle n'existe pas déjà
      if (!document.getElementById("accessibility-animation-styles")) {
        const style = document.createElement("style");
        style.id = "accessibility-animation-styles";
        style.textContent = `
          @keyframes pulse-red {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
          }
          
          .accessibility-badge {
            position: absolute;
            top: 5px;
            left: 5px;
            background: #dc2626;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: bold;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            z-index: 999999;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            pointer-events: none;
            animation: pulse-red 2s infinite;
          }
          
          .accessibility-badge-link {
            position: absolute;
            top: 0;
            left: 0;
            background: #f97316;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: bold;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            z-index: 999999;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            pointer-events: none;
            animation: pulse-red 2s infinite;
            white-space: nowrap;
          }
          
          .accessibility-badge-svg {
            position: absolute;
            top: 5px;
            left: 5px;
            background: #a855f7;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: bold;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            z-index: 999999;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            pointer-events: none;
            animation: pulse-red 2s infinite;
            white-space: nowrap;
          }
        `;
        document.head.appendChild(style);
      }
      issues.push({
        element: `Image ${index + 1}`,
        issue: "Texte alternatif manquant",
        explanation:
          "Sans attribut alt, un utilisateur non-voyant ne peut pas comprendre cette image !",
        severity: "élevée",
        src: img.src,
        imageId: imageId,
        htmlSnippet: generateHTMLSnippet(img),
      });
    } else {
      // Remove style if l'image a un alt valide
      if (img.getAttribute("data-accessibility-issue") === "missing-alt") {
        img.style.border = "";
        img.style.outline = "";
        img.style.outlineOffset = "";
        img.style.boxShadow = "";
        img.style.animation = "";
        img.removeAttribute("data-accessibility-issue");
        img.removeAttribute("data-accessibility-id");

        // Remove badge
        const badge = img.parentElement.querySelector(".accessibility-badge");
        if (badge) {
          badge.remove();
        }

        // Restore parent position si elle a été changée
        if (
          img.parentElement.getAttribute("data-position-changed") === "true"
        ) {
          img.parentElement.style.position = "";
          img.parentElement.removeAttribute("data-position-changed");
        }
      }
    }
  });

  return {
    total: images.length,
    issues: issues,
    passed: images.length - issues.length,
  };
}

// Vérifier si un SVG est accessible
function isSVGAccessible(svg) {
  const hasRole = svg.getAttribute("role") === "img";
  const hasAriaLabel =
    svg.hasAttribute("aria-label") &&
    svg.getAttribute("aria-label").trim() !== "";
  const hasTitle = svg.querySelector("title");
  const isHidden = svg.getAttribute("aria-hidden") === "true";

  return hasRole || hasAriaLabel || hasTitle || isHidden;
}

// Assurer que le parent du SVG a position: relative
function ensureSVGParentPositioned(parent) {
  const originalPosition = window.getComputedStyle(parent).position;
  if (originalPosition === "static") {
    parent.style.position = "relative";
    parent.setAttribute("data-position-changed", "true");
  }
}

// Créer un badge pour un SVG problématique
function createSVGBadge(svg, svgId) {
  if (
    svg.parentElement.querySelector(
      `.accessibility-badge-svg[data-badge-for="${svgId}"]`,
    )
  ) {
    return; // Badge déjà présent
  }

  const badge = document.createElement("div");
  badge.className = "accessibility-badge-svg";
  badge.textContent = "⚠️ SVG NON ACCESSIBLE";
  badge.setAttribute("data-badge-for", svgId);

  ensureSVGParentPositioned(svg.parentElement);
  svg.parentElement.appendChild(badge);
}

// Ajouter le feedback visuel à un SVG problématique
function addVisualFeedbackToSVG(svg, index) {
  const svgId = `accessibility-svg-${index}`;
  svg.setAttribute("data-accessibility-id", svgId);

  // Ajouter les styles visuels (bordure violette)
  svg.style.outline = "5px solid #a855f7";
  svg.style.outlineOffset = "3px";
  svg.style.boxShadow = "0 0 20px rgba(168, 85, 247, 0.6)";
  svg.setAttribute("data-accessibility-issue", "svg-no-desc");

  // Stocker l'élément
  markedElements.svgs.push(svg);

  // Créer le badge
  createSVGBadge(svg, svgId);

  return svgId;
}

// Supprimer le feedback visuel d'un SVG
function removeVisualFeedbackFromSVG(svg) {
  if (svg.getAttribute("data-accessibility-issue") !== "svg-no-desc") {
    return;
  }

  // Supprimer les styles
  svg.style.outline = "";
  svg.style.outlineOffset = "";
  svg.style.boxShadow = "";
  svg.removeAttribute("data-accessibility-issue");
  svg.removeAttribute("data-accessibility-id");

  // Supprimer le badge
  const badge = svg.parentElement.querySelector(".accessibility-badge-svg");
  if (badge) {
    badge.remove();
  }

  // Restaurer la position du parent si elle a été changée
  if (svg.parentElement.getAttribute("data-position-changed") === "true") {
    svg.parentElement.style.position = "";
    svg.parentElement.removeAttribute("data-position-changed");
  }
}

// Créer un objet issue pour un SVG
function createSVGIssue(svg, index, svgId) {
  return {
    element: `SVG ${index + 1}`,
    issue: "SVG inline sans description",
    explanation:
      'Ajoutez role="img" + aria-label, ou un élément title interne, ou aria-hidden="true" si décoratif',
    severity: "élevée",
    svgId: svgId,
    htmlSnippet: generateHTMLSnippet(svg),
  };
}

// Vérifier les SVG inline sans attributs d'accessibilité
function checkSVG() {
  const svgs = document.querySelectorAll("svg");
  const issues = [];

  svgs.forEach((svg, index) => {
    // Vérifier si le SVG est accessible
    if (!isSVGAccessible(svg)) {
      // SVG non accessible : ajouter le feedback visuel
      const svgId = addVisualFeedbackToSVG(svg, index);
      issues.push(createSVGIssue(svg, index, svgId));
    } else {
      // SVG accessible : supprimer le feedback visuel si présent
      removeVisualFeedbackFromSVG(svg);
    }
  });

  return {
    total: svgs.length,
    issues: issues,
    passed: svgs.length - issues.length,
  };
}

// Vérifier les liens
function checkLinks() {
  const links = document.querySelectorAll("a");
  const issues = [];

  links.forEach((link, index) => {
    const linkIssue = analyzeLinkAccessibility(link, index);

    if (linkIssue) {
      addVisualFeedbackToLink(link, linkIssue, index);
      issues.push(linkIssue);
    } else {
      removeVisualFeedbackFromLink(link);
    }
  });

  return {
    total: links.length,
    issues: issues,
    passed: links.length - issues.length,
  };
}

// Analyze l'accessibilité d'un lien
function analyzeLinkAccessibility(link, index) {
  const ariaLabel = link.getAttribute("aria-label");
  const hasAccessibleDescription = checkLinkHasAccessibleDescription(link);
  const text = extractLinkText(link);

  // Case 1 : Lien sans description accessible
  if (!hasAccessibleDescription) {
    return createLinkIssue(
      link,
      index,
      "Lien sans texte descriptif",
      "Sans texte, un utilisateur non-voyant ne sait pas où mène ce lien !",
      "élevée",
      { href: link.href },
    );
  }

  // Case 2 : Texte non descriptif sans aria-label
  if (isNonDescriptiveText(text) && !ariaLabel) {
    return createLinkIssue(
      link,
      index,
      "Texte de lien non descriptif",
      "Ajoutez un aria-label pour décrire la destination (ex: aria-label='En savoir plus sur [sujet]')",
      "moyenne",
      { text: text },
    );
  }

  return null; // Lien valide
}

// Vérifier si un lien a une description accessible
function checkLinkHasAccessibleDescription(link) {
  const ariaLabel = link.getAttribute("aria-label");
  const hasImageWithAlt = link.querySelector('img[alt]:not([alt=""])');
  const hasSVGAccessible = checkLinkHasAccessibleSVG(link);
  const text = extractLinkText(link);

  return text || ariaLabel || hasImageWithAlt || hasSVGAccessible;
}

// Vérifier si le lien contient un SVG accessible
function checkLinkHasAccessibleSVG(link) {
  const svgInLink = link.querySelector("svg");

  if (!svgInLink) {
    return false;
  }

  const hasRole = svgInLink.getAttribute("role") === "img";
  const hasSvgAriaLabel =
    svgInLink.hasAttribute("aria-label") &&
    svgInLink.getAttribute("aria-label").trim() !== "";
  const hasTitle = svgInLink.querySelector("title");

  return hasRole || hasSvgAriaLabel || hasTitle;
}

// Extract le texte d'un lien (sans SVG, images, badges)
function extractLinkText(link) {
  // Utiliser TreeWalker directement pour éviter les problèmes de cloneNode
  // avec les images ayant des srcset invalides ou protégés
  const walker = document.createTreeWalker(link, NODE_FILTER_SHOW_TEXT, {
    acceptNode: function (node) {
      const parent = node.parentElement;

      // Rejeter le texte dans les éléments à ignorer
      if (
        parent &&
        (parent.tagName === "SVG" ||
          parent.tagName === "IMG" ||
          parent.closest("svg") || // Texte dans un SVG
          parent.closest("img") || // Texte dans une img (rare)
          parent.classList.contains("accessibility-badge") ||
          parent.classList.contains("accessibility-badge-link") ||
          parent.classList.contains("accessibility-badge-svg"))
      ) {
        return NODE_FILTER_REJECT;
      }

      return NODE_FILTER_ACCEPT;
    },
  });

  let text = "";
  let node = walker.nextNode();
  while (node) {
    text += node.textContent;
    node = walker.nextNode();
  }

  return text.trim();
}

// Vérifier si le texte est non descriptif
function isNonDescriptiveText(text) {
  const nonDescriptiveTexts = [
    "cliquez ici",
    "en savoir plus",
    "voir",
    "lire la suite",
  ];
  return nonDescriptiveTexts.includes(text.toLowerCase());
}

// Créer un objet d'issue pour un lien
function createLinkIssue(link, index, issue, explanation, severity, details) {
  const linkId = `accessibility-link-${index}`;
  return {
    element: `Lien ${index + 1}`,
    issue: issue,
    explanation: explanation,
    severity: severity,
    linkId: linkId,
    htmlSnippet: generateHTMLSnippet(link),
    ...details,
  };
}

// Add visual feedback à un lien problématique
function addVisualFeedbackToLink(link, linkIssue, index) {
  const linkId = `accessibility-link-${index}`;
  link.setAttribute("data-accessibility-id", linkId);

  const isHighSeverity = linkIssue.severity === "élevée";
  const outlineColor = isHighSeverity ? "#f97316" : "#fbbf24";
  const badgeText = isHighSeverity ? "⚠️ LIEN VIDE" : "⚠️ ARIA-LABEL ?";
  const badgeColor = isHighSeverity ? "#f97316" : "#f59e0b";
  const issueType = isHighSeverity ? "missing-text" : "bad-text";

  // Ajouter le style visuel
  link.style.outline = `3px solid ${outlineColor}`;
  link.style.outlineOffset = "2px";
  link.setAttribute("data-accessibility-issue", issueType);

  // Store l'élément
  markedElements.links.push(link);

  // Créer et ajouter le badge si nécessaire
  addBadgeToLinkParent(link, linkId, badgeText, badgeColor);
}

// Add badge to link parent
function addBadgeToLinkParent(link, linkId, badgeText, badgeColor) {
  if (
    link.parentElement.querySelector(
      `.accessibility-badge-link[data-badge-for="${linkId}"]`,
    )
  ) {
    return; // Badge déjà présent
  }

  const badge = document.createElement("div");
  badge.className = "accessibility-badge-link";
  badge.textContent = badgeText;
  badge.setAttribute("data-badge-for", linkId);
  badge.style.background = badgeColor;

  // Position badge
  ensureParentIsPositioned(link.parentElement);
  link.parentElement.appendChild(badge);
}

// Ensure parent a position: relative
function ensureParentIsPositioned(parent) {
  const originalPosition = window.getComputedStyle(parent).position;
  if (originalPosition === "static") {
    parent.style.position = "relative";
    parent.setAttribute("data-position-changed", "true");
  }
}

// Remove visual feedback d'un lien
function removeVisualFeedbackFromLink(link) {
  if (!link.getAttribute("data-accessibility-issue")) {
    return; // Pas de feedback à retirer
  }

  link.style.outline = "";
  link.style.outlineOffset = "";
  link.removeAttribute("data-accessibility-issue");

  const linkId = link.getAttribute("data-accessibility-id");
  link.removeAttribute("data-accessibility-id");

  // Remove badge
  if (linkId) {
    const badge = link.parentElement.querySelector(
      `.accessibility-badge-link[data-badge-for="${linkId}"]`,
    );
    if (badge) {
      badge.remove();
    }
  }

  // Restore parent position
  if (link.parentElement.getAttribute("data-position-changed") === "true") {
    link.parentElement.style.position = "";
    link.parentElement.removeAttribute("data-position-changed");
  }
}

// Vérifier la structure des titres
function checkHeadings() {
  const headings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");
  const issues = [];
  let previousLevel = 0;
  let issueIndex = 0;

  // Inject CSS styles for badges de titres (une seule fois)
  if (!document.getElementById("accessibility-heading-styles")) {
    const style = document.createElement("style");
    style.id = "accessibility-heading-styles";
    style.textContent = `
      .accessibility-badge-heading {
        position: absolute;
        top: -8px;
        left: 0;
        background: #3b82f6;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: bold;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        z-index: 999999;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        pointer-events: none;
        animation: pulse-red 2s infinite;
        white-space: nowrap;
      }
    `;
    document.head.appendChild(style);
  }

  // Vérifier s'il y a un H1
  const h1Count = document.querySelectorAll("h1").length;
  if (h1Count === 0) {
    issues.push({
      element: "Structure",
      issue: "Aucun titre H1 trouvé sur la page",
      explanation:
        "Le H1 est essentiel pour la structure et le référencement. Il indique le sujet principal de la page aux utilisateurs et aux lecteurs d'écran.",
      severity: "élevée",
    });
  } else if (h1Count > 1) {
    issues.push({
      element: "Structure",
      issue: `${h1Count} titres H1 trouvés (recommandé: 1 seul)`,
      explanation:
        "Une page doit avoir un seul H1 pour une structure claire. Plusieurs H1 peuvent dérouter les utilisateurs de lecteurs d'écran.",
      severity: "moyenne",
    });
  }

  // Vérifier la hiérarchie
  headings.forEach((heading, index) => {
    const level = parseInt(heading.tagName.slice(1));
    // const level = parseInt(heading.tagName.charAt(1));

    if (previousLevel > 0 && level - previousLevel > 1) {
      // Add unique ID for navigation
      const headingId = `accessibility-heading-${issueIndex}`;
      heading.setAttribute("data-accessibility-id", headingId);

      // Add visual style (bordure bleue)
      heading.style.outline = "4px solid #3b82f6";
      heading.style.outlineOffset = "2px";
      heading.setAttribute("data-accessibility-issue", "heading-skip");

      // Store l'élément
      markedElements.headings.push(heading);

      // Créer et ajouter un badge visuel bleu
      if (
        !heading.parentElement.querySelector(
          `.accessibility-badge-heading[data-badge-for="${headingId}"]`,
        )
      ) {
        const badge = document.createElement("div");
        badge.className = "accessibility-badge-heading";
        badge.textContent = `⚠️ SAUT H${previousLevel}→H${level}`;
        badge.setAttribute("data-badge-for", headingId);

        // Position badge
        const originalPosition = window.getComputedStyle(
          heading.parentElement,
        ).position;
        if (originalPosition === "static") {
          heading.parentElement.style.position = "relative";
          heading.parentElement.setAttribute("data-position-changed", "true");
        }

        heading.parentElement.appendChild(badge);
      }

      issues.push({
        element: `${heading.tagName}`,
        issue: `Saut de niveau de titre (de H${previousLevel} à H${level})`,
        explanation:
          "Respecter la hiérarchie des titres (H1→H2→H3) aide les utilisateurs de lecteurs d'écran à comprendre la structure du document.",
        severity: "moyenne",
        text: heading.textContent.trim(),
        headingId: headingId,
        htmlSnippet: generateHTMLSnippet(heading),
      });

      issueIndex++;
    }

    if (!heading.textContent.trim()) {
      // Add unique ID for navigation
      const headingId = `accessibility-heading-${issueIndex}`;
      heading.setAttribute("data-accessibility-id", headingId);

      // Add visual style (bordure bleue)
      heading.style.outline = "4px solid #3b82f6";
      heading.style.outlineOffset = "2px";
      heading.setAttribute("data-accessibility-issue", "heading-empty");

      // Store l'élément
      markedElements.headings.push(heading);

      // Créer et ajouter un badge visuel bleu
      if (
        !heading.parentElement.querySelector(
          `.accessibility-badge-heading[data-badge-for="${headingId}"]`,
        )
      ) {
        const badge = document.createElement("div");
        badge.className = "accessibility-badge-heading";
        badge.textContent = "⚠️ TITRE VIDE";
        badge.setAttribute("data-badge-for", headingId);

        // Position badge
        const originalPosition = window.getComputedStyle(
          heading.parentElement,
        ).position;
        if (originalPosition === "static") {
          heading.parentElement.style.position = "relative";
          heading.parentElement.setAttribute("data-position-changed", "true");
        }

        heading.parentElement.appendChild(badge);
      }

      issues.push({
        element: `${heading.tagName} ${index + 1}`,
        issue: "Titre vide",
        explanation:
          "Un titre vide n'apporte aucune information et perturbe la navigation pour les utilisateurs de technologies d'assistance.",
        severity: "élevée",
        headingId: headingId,
        htmlSnippet: generateHTMLSnippet(heading),
      });

      issueIndex++;
    }

    previousLevel = level;
  });

  return {
    total: headings.length,
    issues: issues,
    passed: headings.length - issues.length,
  };
}

// Vérifier les formulaires
function checkForms() {
  const inputs = document.querySelectorAll(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select',
  );
  const issues = [];
  let issueIndex = 0;

  // Inject CSS styles for badges de formulaires (une seule fois)
  if (!document.getElementById("accessibility-form-styles")) {
    const style = document.createElement("style");
    style.id = "accessibility-form-styles";
    style.textContent = `
      .accessibility-badge-form {
        position: absolute;
        top: -8px;
        left: 0;
        background: #f59e0b;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: bold;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        z-index: 999999;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        pointer-events: none;
        animation: pulse-red 2s infinite;
        white-space: nowrap;
      }
    `;
    document.head.appendChild(style);
  }

  inputs.forEach((input, index) => {
    const id = input.id;
    const label = id
      ? document.querySelector(`label[for="${id}"]`)
      : input.closest("label");
    const ariaLabel = input.getAttribute("aria-label");
    const ariaLabelledby = input.getAttribute("aria-labelledby");

    if (!label && !ariaLabel && !ariaLabelledby) {
      // Add unique ID for navigation
      const formId = `accessibility-form-${issueIndex}`;
      input.setAttribute("data-accessibility-id", formId);

      // Add visual style (bordure orange)
      input.style.outline = "3px solid #f59e0b";
      input.style.outlineOffset = "2px";
      input.setAttribute("data-accessibility-issue", "form-no-label");

      // Store l'élément pour le filtrage
      markedElements.forms.push(input);

      // Créer et ajouter un badge visuel orange
      if (
        !input.parentElement.querySelector(
          `.accessibility-badge-form[data-badge-for="${formId}"]`,
        )
      ) {
        const badge = document.createElement("div");
        badge.className = "accessibility-badge-form";
        badge.textContent = "⚠️ LABEL MANQUANT";
        badge.setAttribute("data-badge-for", formId);

        // Position badge
        const originalPosition = window.getComputedStyle(
          input.parentElement,
        ).position;
        if (originalPosition === "static") {
          input.parentElement.style.position = "relative";
          input.parentElement.setAttribute("data-position-changed", "true");
        }

        input.parentElement.appendChild(badge);
      }

      issues.push({
        element: `${input.tagName} ${index + 1}`,
        issue: "Champ de formulaire sans étiquette",
        explanation:
          "Sans label ou aria-label, les utilisateurs non-voyants ne savent pas quel type d'information saisir dans ce champ.",
        severity: "élevée",
        type: input.type || "text",
        formId: formId,
        htmlSnippet: generateHTMLSnippet(input),
      });

      issueIndex++;
    }
  });

  return {
    total: inputs.length,
    issues: issues,
    passed: inputs.length - issues.length,
  };
}

// Fonction pour injecter les filtres SVG de daltonisme dans la page
function injectColorblindFilters() {
  // Vérifier si les filtres existent déjà
  if (document.getElementById("colorblind-filters")) {
    return;
  }

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.id = "colorblind-filters";
  svg.style.position = "absolute";
  svg.style.width = "0";
  svg.style.height = "0";
  svg.innerHTML = `
    <defs>
      <!-- Protanopie (perte du rouge) -->
      <filter id="protanopia">
        <feColorMatrix type="matrix" values="
          0.567, 0.433, 0,     0, 0
          0.558, 0.442, 0,     0, 0
          0,     0.242, 0.758, 0, 0
          0,     0,     0,     1, 0
        "/>
      </filter>
      
      <!-- Deutéranopie (perte du vert) -->
      <filter id="deuteranopia">
        <feColorMatrix type="matrix" values="
          0.625, 0.375, 0,   0, 0
          0.3,   0.7,   0,   0, 0
          0,     0.3,   0.7, 0, 0
          0,     0,     0,   1, 0
        "/>
      </filter>
    </defs>
  `;
  document.body.appendChild(svg);
}

// Fonction pour appliquer un filtre de daltonisme
function applyColorblindFilter(filterType) {
  injectColorblindFilters();

  if (filterType === "normal") {
    document.body.style.filter = "";
  } else if (filterType === "protanopia") {
    document.body.style.filter = "url(#protanopia)";
  } else if (filterType === "deuteranopia") {
    document.body.style.filter = "url(#deuteranopia)";
  }
}

// Vérifier l'attribut lang
function checkLanguage() {
  const issues = [];
  const htmlElement = document.querySelector("html");

  if (!htmlElement.hasAttribute("lang")) {
    issues.push({
      element: "HTML",
      issue: "Attribut lang manquant sur l'élément &lt;html&gt;",
      explanation:
        "L'attribut lang indique la langue du contenu, permettant aux lecteurs d'écran d'utiliser la bonne prononciation.",
      severity: "élevée",
    });
  }

  return {
    total: 1,
    issues: issues,
    passed: 1 - issues.length,
  };
}

// Vérifier les landmarks ARIA
function checkLandmarks() {
  const issues = [];

  const hasMain = document.querySelector('main, [role="main"]');
  const hasNav = document.querySelector('nav, [role="navigation"]');

  if (!hasMain) {
    issues.push({
      element: "Structure",
      issue: 'Aucun élément <main> ou role="main" trouvé',
      explanation:
        "L'élément &lt;main&gt; identifie le contenu principal et permet aux utilisateurs de lecteurs d'écran d'y accéder directement.",
      severity: "moyenne",
    });
  }

  if (!hasNav) {
    issues.push({
      element: "Structure",
      issue: 'Aucun élément <nav> ou role="navigation" trouvé',
      explanation:
        "L'élément &lt;nav&gt; aide les utilisateurs de technologies d'assistance à identifier et accéder rapidement à la navigation du site.",
      severity: "faible",
    });
  }

  return {
    total: 2,
    issues: issues,
    passed: 2 - issues.length,
  };
}

// Vérifier les boutons
function checkButtons() {
  const buttons = document.querySelectorAll("button");
  const issues = [];
  let issueIndex = 0;

  // Inject CSS styles for badges de boutons (une seule fois)
  if (!document.getElementById("accessibility-button-styles")) {
    const style = document.createElement("style");
    style.id = "accessibility-button-styles";
    style.textContent = `
      .accessibility-badge-button {
        position: absolute;
        top: -8px;
        left: 0;
        background: #10b981;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: bold;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        z-index: 999999;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        pointer-events: none;
        animation: pulse-red 2s infinite;
        white-space: nowrap;
      }
    `;
    document.head.appendChild(style);
  }

  buttons.forEach((button, index) => {
    const text = button.textContent.trim();
    const ariaLabel = button.getAttribute("aria-label");

    if (!text && !ariaLabel) {
      // Add unique ID for navigation
      const buttonId = `accessibility-button-${issueIndex}`;
      button.setAttribute("data-accessibility-id", buttonId);

      // Add visual style (bordure verte)
      button.style.outline = "4px solid #10b981";
      button.style.outlineOffset = "2px";
      button.setAttribute("data-accessibility-issue", "button-no-text");

      // Store l'élément pour le filtrage
      markedElements.buttons.push(button);

      // Créer et ajouter un badge visuel vert
      if (
        !button.parentElement.querySelector(
          `.accessibility-badge-button[data-badge-for="${buttonId}"]`,
        )
      ) {
        const badge = document.createElement("div");
        badge.className = "accessibility-badge-button";
        badge.textContent = "⚠️ TEXTE MANQUANT";
        badge.setAttribute("data-badge-for", buttonId);

        // Position badge
        const originalPosition = window.getComputedStyle(
          button.parentElement,
        ).position;
        if (originalPosition === "static") {
          button.parentElement.style.position = "relative";
          button.parentElement.setAttribute("data-position-changed", "true");
        }

        button.parentElement.appendChild(badge);
      }

      issues.push({
        element: `Bouton ${index + 1}`,
        issue: "Bouton sans texte descriptif",
        explanation:
          "Un bouton sans texte ou aria-label est inutilisable pour les utilisateurs de lecteurs d'écran qui ne comprennent pas son action.",
        severity: "élevée",
        buttonId: buttonId,
        htmlSnippet: generateHTMLSnippet(button),
      });

      issueIndex++;
    }
  });

  return {
    total: buttons.length,
    issues: issues,
    passed: buttons.length - issues.length,
  };
}

// Fonction pour nettoyer tous les styles visuels d'accessibilité
function clearVisualFeedback() {
  const markedImages = document.querySelectorAll(
    '[data-accessibility-issue="missing-alt"]',
  );
  markedImages.forEach((img) => {
    img.style.border = "";
    img.style.outline = "";
    img.style.outlineOffset = "";
    img.style.boxShadow = "";
    img.style.animation = "";
    img.removeAttribute("data-accessibility-issue");
    img.removeAttribute("data-accessibility-id");

    // Remove badge
    const badge = img.parentElement.querySelector(".accessibility-badge");
    if (badge) {
      badge.remove();
    }

    // Restore parent position si elle a été changée
    if (img.parentElement.getAttribute("data-position-changed") === "true") {
      img.parentElement.style.position = "";
      img.parentElement.removeAttribute("data-position-changed");
    }
  });

  // Nettoyer les liens marqués
  const markedLinks = document.querySelectorAll(
    '[data-accessibility-issue="missing-text"], [data-accessibility-issue="bad-text"]',
  );
  markedLinks.forEach((link) => {
    link.style.outline = "";
    link.style.outlineOffset = "";
    link.removeAttribute("data-accessibility-issue");
    link.removeAttribute("data-accessibility-id");

    // Remove badge du lien
    const badge = link.parentElement.querySelector(".accessibility-badge-link");
    if (badge) {
      badge.remove();
    }

    // Restore parent position si elle a été changée
    if (link.parentElement.getAttribute("data-position-changed") === "true") {
      link.parentElement.style.position = "";
      link.parentElement.removeAttribute("data-position-changed");
    }
  });

  // Nettoyer les SVG marqués
  const markedSVGs = document.querySelectorAll(
    '[data-accessibility-issue="svg-no-desc"]',
  );
  markedSVGs.forEach((svg) => {
    svg.style.outline = "";
    svg.style.outlineOffset = "";
    svg.style.boxShadow = "";
    svg.removeAttribute("data-accessibility-issue");
    svg.removeAttribute("data-accessibility-id");

    // Remove badge du SVG
    const badge = svg.parentElement.querySelector(".accessibility-badge-svg");
    if (badge) {
      badge.remove();
    }

    // Restore parent position si elle a été changée
    if (svg.parentElement.getAttribute("data-position-changed") === "true") {
      svg.parentElement.style.position = "";
      svg.parentElement.removeAttribute("data-position-changed");
    }
  });

  // Nettoyer les titres marqués
  const markedHeadings = document.querySelectorAll(
    '[data-accessibility-issue="heading-skip"], [data-accessibility-issue="heading-empty"]',
  );
  markedHeadings.forEach((heading) => {
    heading.style.outline = "";
    heading.style.outlineOffset = "";
    heading.removeAttribute("data-accessibility-issue");
    heading.removeAttribute("data-accessibility-id");

    // Remove badge du titre
    const badge = heading.parentElement.querySelector(
      ".accessibility-badge-heading",
    );
    if (badge) {
      badge.remove();
    }

    // Restore parent position si elle a été changée
    if (
      heading.parentElement.getAttribute("data-position-changed") === "true"
    ) {
      heading.parentElement.style.position = "";
      heading.parentElement.removeAttribute("data-position-changed");
    }
  });

  // Nettoyer les formulaires marqués
  const markedForms = document.querySelectorAll(
    '[data-accessibility-issue="form-no-label"]',
  );
  markedForms.forEach((form) => {
    form.style.outline = "";
    form.style.outlineOffset = "";
    form.removeAttribute("data-accessibility-issue");
    form.removeAttribute("data-accessibility-id");

    // Remove badge du formulaire
    const badge = form.parentElement.querySelector(".accessibility-badge-form");
    if (badge) {
      badge.remove();
    }

    // Restore parent position si elle a été changée
    if (form.parentElement.getAttribute("data-position-changed") === "true") {
      form.parentElement.style.position = "";
      form.parentElement.removeAttribute("data-position-changed");
    }
  });

  // Nettoyer les boutons marqués
  const markedButtons = document.querySelectorAll(
    '[data-accessibility-issue="button-no-text"]',
  );
  markedButtons.forEach((button) => {
    button.style.outline = "";
    button.style.outlineOffset = "";
    button.removeAttribute("data-accessibility-issue");
    button.removeAttribute("data-accessibility-id");

    // Remove badge du bouton
    const badge = button.parentElement.querySelector(
      ".accessibility-badge-button",
    );
    if (badge) {
      badge.remove();
    }

    // Restore parent position si elle a été changée
    if (button.parentElement.getAttribute("data-position-changed") === "true") {
      button.parentElement.style.position = "";
      button.parentElement.removeAttribute("data-position-changed");
    }
  });

  // Nettoyer les éléments avec problème de contraste
  const markedContrast = document.querySelectorAll(
    '[data-accessibility-issue="low-contrast"]',
  );
  markedContrast.forEach((el) => {
    el.style.outline = "";
    el.style.outlineOffset = "";
    el.style.boxShadow = "";
    el.removeAttribute("data-accessibility-issue");
    el.removeAttribute("data-accessibility-id");

    // Remove badge du contraste
    const badge = el.parentElement.querySelector(
      ".accessibility-badge-contrast",
    );
    if (badge) {
      badge.remove();
    }

    // Restore parent position si elle a été changée
    if (el.parentElement.getAttribute("data-position-changed") === "true") {
      el.parentElement.style.position = "";
      el.parentElement.removeAttribute("data-position-changed");
    }
  });

  // Retirer tous les badges orphelins (au cas où)
  document.querySelectorAll(".accessibility-badge").forEach((badge) => {
    badge.remove();
  });
  document.querySelectorAll(".accessibility-badge-link").forEach((badge) => {
    badge.remove();
  });
  document.querySelectorAll(".accessibility-badge-svg").forEach((badge) => {
    badge.remove();
  });
  document.querySelectorAll(".accessibility-badge-heading").forEach((badge) => {
    badge.remove();
  });
  document.querySelectorAll(".accessibility-badge-form").forEach((badge) => {
    badge.remove();
  });
  document.querySelectorAll(".accessibility-badge-button").forEach((badge) => {
    badge.remove();
  });
  document
    .querySelectorAll(".accessibility-badge-contrast")
    .forEach((badge) => {
      badge.remove();
    });

  // Retirer les styles d'animation
  const animationStyles = document.getElementById(
    "accessibility-animation-styles",
  );
  if (animationStyles) {
    animationStyles.remove();
  }

  // Retirer les styles de badge de contraste
  const contrastBadgeStyle = document.getElementById(
    "accessibility-contrast-badge-style",
  );
  if (contrastBadgeStyle) {
    contrastBadgeStyle.remove();
  }
}

// Fonction pour scroller vers une image spécifique
function scrollToImage(imageId) {
  const element = document.querySelector(
    `[data-accessibility-id="${imageId}"]`,
  );

  // Vérifier si l'élément existe
  if (!element) {
    return false;
  }

  try {
    element.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    // Bordure épaisse très visible pour identifier l'élément
    const originalStyles = {
      outline: element.style.outline,
      outlineOffset: element.style.outlineOffset,
      boxShadow: element.style.boxShadow,
      transform: element.style.transform,
      transition: element.style.transition,
      zIndex: element.style.zIndex,
      position: element.style.position,
    };

    // Utiliser box-shadow pour garantir la visibilité externe
    // Z-index élevé pour être au-dessus des badges
    const currentPosition = window.getComputedStyle(element).position;
    if (currentPosition === "static") {
      element.style.position = "relative";
    }
    element.style.zIndex = "9999999";
    element.style.outline = "none";
    element.style.boxShadow =
      "0 0 0 15px #FF10F0, 0 0 60px 15px rgba(255, 16, 240, 0.8)";
    element.style.transform = "scale(1.05)";
    element.style.transition = "transform 0.3s ease";

    setTimeout(() => {
      Object.assign(element.style, originalStyles);
    }, HIGHLIGHT_DURATION);

    return true;
  } catch (error) {
    console.error(`Erreur lors du scroll vers ${imageId}:`, error);
    return false;
  }
}

// Fonction pour scroller vers un lien spécifique
function scrollToLink(linkId) {
  const element = document.querySelector(`[data-accessibility-id="${linkId}"]`);

  if (!element) {
    return false;
  }

  try {
    element.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    // Bordure épaisse très visible pour identifier l'élément
    const originalStyles = {
      outline: element.style.outline,
      outlineOffset: element.style.outlineOffset,
      boxShadow: element.style.boxShadow,
      transform: element.style.transform,
      transition: element.style.transition,
      zIndex: element.style.zIndex,
      position: element.style.position,
    };

    // Utiliser box-shadow pour garantir la visibilité externe
    // Z-index élevé pour être au-dessus des badges
    const currentPosition = window.getComputedStyle(element).position;
    if (currentPosition === "static") {
      element.style.position = "relative";
    }
    element.style.zIndex = "9999999";
    element.style.outline = "none";
    element.style.boxShadow =
      "0 0 0 15px #FF10F0, 0 0 60px 15px rgba(255, 16, 240, 0.8)";
    element.style.transform = "scale(1.05)";
    element.style.transition = "transform 0.3s ease";

    setTimeout(() => {
      Object.assign(element.style, originalStyles);
    }, HIGHLIGHT_DURATION);

    return true;
  } catch (error) {
    console.error(`Erreur lors du scroll vers ${linkId}:`, error);
    return false;
  }
}

// Fonction pour scroller vers un SVG spécifique
function scrollToSVG(svgId) {
  const element = document.querySelector(`[data-accessibility-id="${svgId}"]`);

  if (!element) {
    return false;
  }

  try {
    element.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    // Bordure épaisse très visible pour identifier l'élément
    const originalStyles = {
      outline: element.style.outline,
      outlineOffset: element.style.outlineOffset,
      boxShadow: element.style.boxShadow,
      transform: element.style.transform,
      transition: element.style.transition,
      zIndex: element.style.zIndex,
      position: element.style.position,
    };

    // Utiliser box-shadow pour garantir la visibilité externe
    // Z-index élevé pour être au-dessus des badges
    const currentPosition = window.getComputedStyle(element).position;
    if (currentPosition === "static") {
      element.style.position = "relative";
    }
    element.style.zIndex = "9999999";
    element.style.outline = "none";
    element.style.boxShadow =
      "0 0 0 15px #FF10F0, 0 0 60px 15px rgba(255, 16, 240, 0.8)";
    element.style.transform = "scale(1.05)";
    element.style.transition = "transform 0.3s ease";

    setTimeout(() => {
      Object.assign(element.style, originalStyles);
    }, HIGHLIGHT_DURATION);

    return true;
  } catch (error) {
    console.error(`Erreur lors du scroll vers ${svgId}:`, error);
    return false;
  }
}

// Fonction pour scroller vers un titre spécifique
function scrollToHeading(headingId) {
  const element = document.querySelector(
    `[data-accessibility-id="${headingId}"]`,
  );

  if (!element) {
    return false;
  }

  try {
    element.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    // Bordure épaisse très visible pour identifier l'élément
    const originalStyles = {
      outline: element.style.outline,
      outlineOffset: element.style.outlineOffset,
      boxShadow: element.style.boxShadow,
      transform: element.style.transform,
      transition: element.style.transition,
      zIndex: element.style.zIndex,
      position: element.style.position,
    };

    // Utiliser box-shadow pour garantir la visibilité externe
    // Z-index élevé pour être au-dessus des badges
    const currentPosition = window.getComputedStyle(element).position;
    if (currentPosition === "static") {
      element.style.position = "relative";
    }
    element.style.zIndex = "9999999";
    element.style.outline = "none";
    element.style.boxShadow =
      "0 0 0 15px #FF10F0, 0 0 60px 15px rgba(255, 16, 240, 0.8)";
    element.style.transform = "scale(1.05)";
    element.style.transition = "transform 0.3s ease";

    setTimeout(() => {
      Object.assign(element.style, originalStyles);
    }, HIGHLIGHT_DURATION);

    return true;
  } catch (error) {
    console.error(`Erreur lors du scroll vers ${headingId}:`, error);
    return false;
  }
}

// Fonction pour scroller vers un formulaire spécifique
function scrollToForm(formId) {
  const element = document.querySelector(`[data-accessibility-id="${formId}"]`);

  if (!element) {
    return false;
  }

  try {
    element.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    // Bordure épaisse très visible pour identifier l'élément
    const originalStyles = {
      outline: element.style.outline,
      outlineOffset: element.style.outlineOffset,
      boxShadow: element.style.boxShadow,
      transform: element.style.transform,
      transition: element.style.transition,
      zIndex: element.style.zIndex,
      position: element.style.position,
    };

    // Utiliser box-shadow pour garantir la visibilité externe
    // Z-index élevé pour être au-dessus des badges
    const currentPosition = window.getComputedStyle(element).position;
    if (currentPosition === "static") {
      element.style.position = "relative";
    }
    element.style.zIndex = "9999999";
    element.style.outline = "none";
    element.style.boxShadow =
      "0 0 0 15px #FF10F0, 0 0 60px 15px rgba(255, 16, 240, 0.8)";
    element.style.transform = "scale(1.05)";
    element.style.transition = "transform 0.3s ease";

    setTimeout(() => {
      Object.assign(element.style, originalStyles);
    }, HIGHLIGHT_DURATION);

    return true;
  } catch (error) {
    console.error(`Erreur lors du scroll vers ${formId}:`, error);
    return false;
  }
}

// Fonction pour scroller vers un bouton spécifique
function scrollToButton(buttonId) {
  const element = document.querySelector(
    `[data-accessibility-id="${buttonId}"]`,
  );

  if (!element) {
    return false;
  }

  try {
    element.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    // Bordure épaisse très visible pour identifier l'élément
    const originalStyles = {
      outline: element.style.outline,
      outlineOffset: element.style.outlineOffset,
      boxShadow: element.style.boxShadow,
      transform: element.style.transform,
      transition: element.style.transition,
      zIndex: element.style.zIndex,
      position: element.style.position,
    };

    // Utiliser box-shadow pour garantir la visibilité externe
    // Z-index élevé pour être au-dessus des badges
    const currentPosition = window.getComputedStyle(element).position;
    if (currentPosition === "static") {
      element.style.position = "relative";
    }
    element.style.zIndex = "9999999";
    element.style.outline = "none";
    element.style.boxShadow =
      "0 0 0 15px #FF10F0, 0 0 60px 15px rgba(255, 16, 240, 0.8)";
    element.style.transform = "scale(1.05)";
    element.style.transition = "transform 0.3s ease";

    setTimeout(() => {
      Object.assign(element.style, originalStyles);
    }, HIGHLIGHT_DURATION);

    return true;
  } catch (error) {
    console.error(`Erreur lors du scroll vers ${buttonId}:`, error);
    return false;
  }
}

// Fonction pour scroller vers un élément avec problème de contraste
function scrollToContrast(contrastId) {
  const element = document.querySelector(
    `[data-accessibility-id="${contrastId}"]`,
  );

  if (!element) {
    return false;
  }

  try {
    element.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    // Bordure épaisse très visible pour identifier l'élément
    const originalStyles = {
      outline: element.style.outline,
      outlineOffset: element.style.outlineOffset,
      boxShadow: element.style.boxShadow,
      transform: element.style.transform,
      transition: element.style.transition,
      zIndex: element.style.zIndex,
      position: element.style.position,
    };

    // Utiliser box-shadow violet foncé pour identifier l'élément
    const currentPosition = window.getComputedStyle(element).position;
    if (currentPosition === "static") {
      element.style.position = "relative";
    }
    element.style.zIndex = "9999999";
    element.style.outline = "none";
    element.style.boxShadow =
      "0 0 0 15px #6b21a8, 0 0 60px 15px rgba(107, 33, 168, 0.8)";
    element.style.transform = "scale(1.05)";
    element.style.transition = "transform 0.3s ease";

    setTimeout(() => {
      Object.assign(element.style, originalStyles);
    }, HIGHLIGHT_DURATION);

    return true;
  } catch (error) {
    console.error(`Erreur lors du scroll vers ${contrastId}:`, error);
    return false;
  }
}

// Map des gestionnaires d'actions pour réduire la complexité
const messageHandlers = {
  ping: (request, sendResponse) => {
    // Répondre au ping pour confirmer que le script est injecté
    sendResponse({ ready: true });
  },
  runAudit: (request, sendResponse) => {
    const results = auditAccessibility();
    sendResponse({ results: results });
  },
  clearVisualFeedback: (request, sendResponse) => {
    clearVisualFeedback();
    sendResponse({ success: true });
  },
  scrollToImage: (request, sendResponse) => {
    const success = scrollToImage(request.imageId);
    sendResponse({ success });
  },
  scrollToLink: (request, sendResponse) => {
    const success = scrollToLink(request.linkId);
    sendResponse({ success });
  },
  scrollToSVG: (request, sendResponse) => {
    const success = scrollToSVG(request.svgId);
    sendResponse({ success });
  },
  scrollToHeading: (request, sendResponse) => {
    const success = scrollToHeading(request.headingId);
    sendResponse({ success });
  },
  scrollToForm: (request, sendResponse) => {
    const success = scrollToForm(request.formId);
    sendResponse({ success });
  },
  scrollToButton: (request, sendResponse) => {
    const success = scrollToButton(request.buttonId);
    sendResponse({ success });
  },
  scrollToContrast: (request, sendResponse) => {
    const success = scrollToContrast(request.contrastId);
    sendResponse({ success });
  },
  applyColorblindFilter: (request, sendResponse) => {
    applyColorblindFilter(request.filterType);
    sendResponse({ success: true });
  },
  updateFilters: (request, sendResponse) => {
    updateVisualMarkersWithFilters(request.filters);
    sendResponse({ success: true });
  },
};

// Écouter les messages du popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const handler = messageHandlers[request.action];
  if (handler) {
    handler(request, sendResponse);
  }
  return true;
});

// Fonction pour mettre à jour les marqueurs visuels selon les filtres actifs
function updateVisualMarkersWithFilters(filters) {
  // Images - utiliser le tableau stocké
  markedElements.images.forEach((img) => {
    if (!img.parentElement) {
      return;
    }

    const badge = img.parentElement.querySelector(
      '[data-badge-for^="accessibility-img-"]',
    );

    if (filters.images) {
      // Réactiver les marqueurs
      img.style.border = "5px solid #ef4444";
      img.style.outline = "5px solid #cc0808";
      img.style.outlineOffset = "3px";
      img.style.boxShadow = "0 0 20px rgba(239, 68, 68, 0.6)";
      img.style.animation = "pulse-red 2s infinite";
      if (badge) {
        badge.style.display = "";
      }
    } else {
      // Masquer les marqueurs
      img.style.border = "none";
      img.style.outline = "none";
      img.style.outlineOffset = "0";
      img.style.boxShadow = "none";
      img.style.animation = "none";
      if (badge) {
        badge.style.display = "none";
      }
    }
  });

  // SVG - utiliser le tableau stocké
  markedElements.svgs.forEach((svg) => {
    if (!svg.parentElement) {
      return;
    }

    const badge = svg.parentElement.querySelector(".accessibility-badge-svg");

    if (filters.svg) {
      svg.style.outline = "5px solid #a855f7";
      svg.style.outlineOffset = "3px";
      svg.style.boxShadow = "0 0 20px rgba(168, 85, 247, 0.6)";
      if (badge) {
        badge.style.display = "";
      }
    } else {
      svg.style.outline = "none";
      svg.style.outlineOffset = "0";
      svg.style.boxShadow = "none";
      if (badge) {
        badge.style.display = "none";
      }
    }
  });

  // Liens - utiliser le tableau stocké
  markedElements.links.forEach((link) => {
    if (!link.parentElement) {
      return;
    }

    const badge = link.parentElement.querySelector(".accessibility-badge-link");
    const issue = link.getAttribute("data-accessibility-issue");

    if (filters.links) {
      // Réappliquer le style selon le type d'issue
      if (issue === "missing-text") {
        link.style.outline = "3px solid #f97316";
      } else if (issue === "bad-text") {
        link.style.outline = "3px solid #fbbf24";
      }
      link.style.outlineOffset = "2px";
      if (badge) {
        badge.style.display = "";
      }
    } else {
      link.style.outline = "none";
      link.style.outlineOffset = "0";
      if (badge) {
        badge.style.display = "none";
      }
    }
  });

  // Titres - utiliser le tableau stocké
  markedElements.headings.forEach((heading) => {
    if (!heading.parentElement) {
      return;
    }

    const badge = heading.parentElement.querySelector(
      ".accessibility-badge-heading",
    );

    if (filters.headings) {
      heading.style.outline = "4px solid #3b82f6";
      heading.style.outlineOffset = "2px";
      if (badge) {
        badge.style.display = "";
      }
    } else {
      heading.style.outline = "none";
      heading.style.outlineOffset = "0";
      if (badge) {
        badge.style.display = "none";
      }
    }
  });

  // Formulaires - utiliser le tableau stocké
  markedElements.forms.forEach((form) => {
    if (!form.parentElement) {
      return;
    }

    const badge = form.parentElement.querySelector(".accessibility-badge-form");

    if (filters.forms) {
      form.style.outline = "4px solid #f59e0b";
      form.style.outlineOffset = "2px";
      if (badge) {
        badge.style.display = "";
      }
    } else {
      form.style.outline = "none";
      form.style.outlineOffset = "0";
      if (badge) {
        badge.style.display = "none";
      }
    }
  });

  // Boutons - utiliser le tableau stocké
  markedElements.buttons.forEach((button) => {
    if (!button.parentElement) {
      return;
    }

    const badge = button.parentElement.querySelector(
      ".accessibility-badge-button",
    );

    if (filters.buttons) {
      button.style.outline = "4px solid #10b981";
      button.style.outlineOffset = "2px";
      if (badge) {
        badge.style.display = "";
      }
    } else {
      button.style.outline = "none";
      button.style.outlineOffset = "0";
      if (badge) {
        badge.style.display = "none";
      }
    }
  });

  // Contraste - utiliser le tableau stocké
  markedElements.contrast.forEach((el) => {
    if (!el.parentElement) {
      return;
    }

    const badge = el.parentElement.querySelector(
      ".accessibility-badge-contrast",
    );

    if (filters.contrast) {
      el.style.outline = "3px solid #6b21a8";
      el.style.outlineOffset = "2px";
      el.style.boxShadow = "0 0 15px rgba(107, 33, 168, 0.5)";
      if (badge) {
        badge.style.display = "";
      }
    } else {
      el.style.outline = "none";
      el.style.outlineOffset = "0";
      el.style.boxShadow = "none";
      if (badge) {
        badge.style.display = "none";
      }
    }
  });
}
// module.exports = { injectColorblindFilters };
