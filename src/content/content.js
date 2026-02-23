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
};

// Constantes NodeFilter
const NODE_FILTER_SHOW_TEXT = 4;
const NODE_FILTER_ACCEPT = 1;
const NODE_FILTER_REJECT = 2;

// Durée de l'effet de mise en évidence (en ms)
const HIGHLIGHT_DURATION = 3000;

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

  const results = {
    images: checkImages(),
    svg: checkSVG(),
    links: checkLinks(),
    headings: checkHeadings(),
    forms: checkForms(),
    colorblind: { total: 0, issues: [], passed: 0 },
    lang: checkLanguage(),
    landmarks: checkLandmarks(),
    buttons: checkButtons(),
  };

  return results;
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
function createSVGIssue(index, svgId) {
  return {
    element: `SVG ${index + 1}`,
    issue: "SVG inline sans description",
    explanation:
      'Ajoutez role="img" + aria-label, ou un élément title interne, ou aria-hidden="true" si décoratif',
    severity: "élevée",
    svgId: svgId,
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
      issues.push(createSVGIssue(index, svgId));
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
function createLinkIssue(index, issue, explanation, severity, details) {
  const linkId = `accessibility-link-${index}`;
  return {
    element: `Lien ${index + 1}`,
    issue: issue,
    explanation: explanation,
    severity: severity,
    linkId: linkId,
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

  // Retirer les styles d'animation
  const animationStyles = document.getElementById(
    "accessibility-animation-styles",
  );
  if (animationStyles) {
    animationStyles.remove();
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

// Map des gestionnaires d'actions pour réduire la complexité cyclomatique
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
}
// module.exports = { injectColorblindFilters };
