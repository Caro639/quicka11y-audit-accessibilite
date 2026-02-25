/**
 * popup-utils.js
 * Fonctions pures pour la génération de HTML et le traitement de données
 *
 *  Principe Clean Code : Separation of Concerns
 * - Ce fichier contient UNIQUEMENT des fonctions PURES
 * - Pas d'effets de bord (pas de modification de variables globales)
 * - Pas d'accès au DOM
 * - Pas d'appels async
 *
 * - Facile à tester (input → output prévisible)
 * - Réutilisable dans d'autres contextes
 * - Maintenable et lisible
 */

// ============================================================================
// CONSTANTES
// ============================================================================

export const MAX_TEXT_LENGTH = 80;
export const MAX_URL_LENGTH = 60;

// ============================================================================
// FONCTIONS DE DONNÉES MDN
// ============================================================================

/**
 * Retourne les liens MDN pour une catégorie donnée
 * @param {string} category - Catégorie (images, svg, links, headings, forms, structure)
 * @returns {Array<{title: string, url: string}>} - Liste des liens MDN
 */
export function getMdnLinks(category) {
  const mdnLinks = {
    images: [
      {
        title: "Guide d'accessibilité des images (MDN)",
        url: "https://developer.mozilla.org/fr/docs/Web/HTML/Element/img#accessibilit%C3%A9",
      },
      {
        title: "Attribut alt pour les images",
        url: "https://developer.mozilla.org/fr/docs/Web/HTML/Element/img#fournir_un_texte_de_remplacement_utile",
      },
    ],
    svg: [
      {
        title: "Identifier le SVG comme une image",
        url: "https://developer.mozilla.org/fr/docs/Web/HTML/Element/img#identifier_le_svg_comme_une_image",
      },
      {
        title: "Accessibilité des SVG",
        url: "https://developer.mozilla.org/fr/docs/Web/SVG/Guides/SVG_in_HTML",
      },
      {
        title: "Utiliser role='img' et aria-label",
        url: "https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/img_role#svg_and_roleimg",
      },
    ],
    links: [
      {
        title: "Accessibilité des liens",
        url: "https://developer.mozilla.org/fr/docs/Web/HTML/Element/a#accessibilit%C3%A9",
      },
      {
        title: "Créer un lien avec une image",
        url: "https://developer.mozilla.org/fr/docs/Web/HTML/Element/img#cr%C3%A9er_un_lien_avec_une_image",
      },
      {
        title: "ARIA: link role",
        url: "https://developer.mozilla.org/fr/docs/Web/Accessibility/ARIA/Roles/link_role",
      },
    ],
    headings: [
      {
        title: "Structurer le contenu avec des titres",
        url: "https://developer.mozilla.org/fr/docs/Web/HTML/Element/Heading_Elements#accessibilit%C3%A9",
      },
      {
        title: "Guide des titres et structure",
        url: "https://developer.mozilla.org/fr/docs/Learn_web_development/Core/Accessibility/HTML#une_bonne_s%C3%A9mantique",
      },
    ],
    forms: [
      {
        title: "Formulaires accessibles",
        url: "https://developer.mozilla.org/fr/docs/Web/HTML/Element/input#accessibilit%C3%A9",
      },
      {
        title: "Élément label pour les formulaires",
        url: "https://developer.mozilla.org/fr/docs/Web/HTML/Reference/Elements/label#accessibilit%C3%A9",
      },
      {
        title: "ARIA dans les formulaires",
        url: "https://developer.mozilla.org/fr/docs/Web/HTML/Reference/Elements/form",
      },
    ],
    structure: [
      {
        title: "Structure du document et sémantique HTML",
        url: "https://developer.mozilla.org/fr/docs/Learn_web_development/Core/Accessibility/HTML#une_bonne_s%C3%A9mantique",
      },
      {
        title: "Accessibilité des boutons",
        url: "https://developer.mozilla.org/fr/docs/Web/HTML/Reference/Elements/button#accessibilit%C3%A9",
      },
      {
        title: "Attribut lang pour la langue",
        url: "https://developer.mozilla.org/fr/docs/Web/HTML/Global_attributes/lang",
      },
    ],
    contrast: [
      {
        title: "Comprendre le contraste WCAG (WebAIM)",
        url: "https://webaim.org/articles/contrast/",
      },
      {
        title: "Color Contrast - Guide WCAG",
        url: "https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html",
      },
    ],
  };
  return mdnLinks[category] || [];
}

// ============================================================================
// FONCTIONS DE GÉNÉRATION HTML
// ============================================================================

/**
 * Génère le HTML des liens MDN pour une issue
 * @param {string} name - Nom de la catégorie
 * @param {number} issueIndex - Index de l'issue (0 = première)
 * @returns {string} - HTML des liens MDN
 */
export function generateMdnLinksHTML(name, issueIndex) {
  const mdnLinks = getMdnLinks(name);

  if (mdnLinks.length === 0) {
    return "";
  }

  const linksContent = mdnLinks
    .map(
      (link) =>
        `<p class="issue-mdn-link"><a href="${link.url}" target="_blank" rel="noopener noreferrer">${link.title}</a></p>`,
    )
    .join("");

  // Première erreur : afficher les liens normalement
  if (issueIndex === 0) {
    return linksContent;
  }

  // Erreurs suivantes : bouton repliable
  return `
    <div class="mdn-links-collapsed">
      <span class="toggle-resources-link" data-resources-id="res-${name}-${issueIndex}">
        <svg class="resources-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span class="resources-text">Ressources</span>
      </span>
      <div class="mdn-links-content" id="res-${name}-${issueIndex}" style="display: none;">
        ${linksContent}
      </div>
    </div>
  `;
}

// ============================================================================
// FONCTIONS DE GÉNÉRATION HTML - DÉTAILS D'ISSUES
// ============================================================================

/**
 * Tronque une chaîne si elle dépasse la longueur maximale
 * @param {string} text - Texte à tronquer
 * @param {number} maxLength - Longueur maximale
 * @returns {string} - Texte tronqué avec "..." si nécessaire
 */
function truncateText(text, maxLength) {
  return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
}

/**
 * Génère le HTML pour les détails textuels standards (text, src, href, type)
 * @param {Object} issue - Objet issue
 * @returns {Array<string>} - Tableau de HTML pour les détails textuels
 */
function generateStandardTextDetails(issue) {
  const details = [];

  if (issue.text) {
    const truncatedText = truncateText(issue.text, MAX_TEXT_LENGTH);
    details.push(`<p class="issue-detail">Texte: "${truncatedText}"</p>`);
  }

  if (issue.src) {
    const truncatedSrc = truncateText(issue.src, MAX_URL_LENGTH);
    details.push(`<p class="issue-detail">Source: ${truncatedSrc}</p>`);
  }

  if (issue.href) {
    const truncatedHref = truncateText(issue.href, MAX_URL_LENGTH);
    details.push(`<p class="issue-detail">Lien: ${truncatedHref}</p>`);
  }

  if (issue.type) {
    details.push(`<p class="issue-detail">Type: ${issue.type}</p>`);
  }

  return details;
}

/**
 * Génère le HTML pour les détails spécifiques au contraste
 * @param {Object} issue - Objet issue avec propriétés de contraste
 * @returns {Array<string>} - Tableau de HTML pour les détails de contraste
 */
function generateContrastDetails(issue) {
  const details = [];

  if (issue.ratio) {
    details.push(
      `<p class="issue-detail">Ratio actuel: <strong>${issue.ratio}:1</strong> (minimum requis: <strong>${issue.required}:1</strong>)</p>`,
    );
  }

  if (issue.fgColor && issue.bgColor) {
    details.push(
      `<p class="issue-detail">Couleur texte: <span style="padding: 2px 6px;">${issue.fgColor}</span></p>`,
    );
    details.push(
      `<p class="issue-detail">Couleur fond: <span style="padding: 2px 6px;">${issue.bgColor}</span></p>`,
    );
  }

  if (issue.fontSize) {
    details.push(
      `<p class="issue-detail">Taille de police: ${issue.fontSize}</p>`,
    );
  }

  return details;
}

/**
 * Échappe les caractères HTML pour un affichage sûr dans le code
 * @param {string} html - Code HTML à échapper
 * @returns {string} - HTML échappé
 */
function escapeHTML(html) {
  const div = document.createElement("div");
  div.textContent = html;
  return div.innerHTML;
}

/**
 * Génère le HTML pour afficher un extrait de code
 * @param {string} htmlSnippet - Extrait de code HTML
 * @param {string} name - Nom de la catégorie
 * @param {number} issueIndex - Index de l'issue
 * @returns {string} - HTML de l'extrait de code
 */
export function generateCodeSnippetHTML(htmlSnippet, name, issueIndex) {
  if (!htmlSnippet) {
    return "";
  }

  const escapedSnippet = escapeHTML(htmlSnippet);
  const snippetId = `code-snippet-${name}-${issueIndex}`;

  return `
    <div class="code-snippet-container">
      <button class="toggle-code-snippet" data-snippet-id="${snippetId}">
        <svg class="code-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 18L22 12L16 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M8 6L2 12L8 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>Voir le code HTML</span>
      </button>
      <div class="code-snippet-content" id="${snippetId}" style="display: none;">
        <pre><code>${escapedSnippet}</code></pre>
      </div>
    </div>
  `;
}

/**
 * Génère le HTML des détails d'une issue (texte, src, href, type, contraste)
 * Fonction orchestratrice qui délègue à des fonctions spécialisées
 * @param {Object} issue - Objet issue avec propriétés optionnelles
 * @returns {string} - HTML des détails
 */
export function generateIssueDetailsHTML(issue) {
  const standardDetails = generateStandardTextDetails(issue);
  const contrastDetails = generateContrastDetails(issue);

  return [...standardDetails, ...contrastDetails].join("");
}

/**
 * Génère le HTML des boutons de navigation "Voir dans la page"
 * @param {Object} issue - Objet issue avec IDs optionnels (imageId, linkId, etc.)
 * @returns {string} - HTML des boutons de navigation
 */
export function generateNavigationButtonsHTML(issue) {
  const buttons = [];
  const idTypes = [
    "imageId",
    "linkId",
    "svgId",
    "headingId",
    "formId",
    "buttonId",
    "contrastId",
  ];

  idTypes.forEach((idType) => {
    if (issue[idType]) {
      buttons.push(
        `<button class="goto-btn" data-${idType.replace(/Id$/, "-id")}="${issue[idType]}">Voir dans la page</button>`,
      );
    }
  });

  return buttons.join("");
}

/**
 * Génère le HTML complet d'une issue
 * Combine tous les éléments : en-tête, description, liens MDN, détails, navigation
 * @param {Object} issue - Objet issue complet
 * @param {number} issueIndex - Index de l'issue
 * @param {string} name - Nom de la catégorie
 * @returns {string} - HTML complet de l'issue
 */
export function generateIssueHTML(issue, issueIndex, name) {
  const mdnLinksHTML = generateMdnLinksHTML(name, issueIndex);
  const detailsHTML = generateIssueDetailsHTML(issue);
  const codeSnippetHTML = generateCodeSnippetHTML(
    issue.htmlSnippet,
    name,
    issueIndex,
  );
  const navigationButtonsHTML = generateNavigationButtonsHTML(issue);

  const explanationHTML = issue.explanation
    ? `<p class="issue-explanation"><svg class="explanation-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C8.13 2 5 5.13 5 9C5 11.38 6.19 13.47 8 14.74V17C8 17.55 8.45 18 9 18H15C15.55 18 16 17.55 16 17V14.74C17.81 13.47 19 11.38 19 9C19 5.13 15.87 2 12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 21H15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> ${issue.explanation}</p>`
    : "";

  return `
    <div class="issue ${issue.severity}">
      <div class="issue-header">
        <span class="issue-element">${issue.element}</span>
        <span class="severity-badge severity-${issue.severity}">${issue.severity}</span>
      </div>
      <p class="issue-description">${issue.issue}</p>
      ${explanationHTML}
      ${mdnLinksHTML}
      ${detailsHTML}
      ${codeSnippetHTML}
      ${navigationButtonsHTML}
      <button class="markdown-btn" data-issue-index="${issueIndex}" data-category="${name}">Copier Markdown</button>
    </div>
  `;
}

// ============================================================================
// FONCTIONS DE TRAITEMENT DE DONNÉES
// ============================================================================

/**
 * Combine les données de structure (lang, landmarks, buttons) en un seul objet
 * @param {Object} filteredResults - Résultats filtrés contenant lang, landmarks, buttons
 * @returns {Object} - Objet combiné avec total, issues, passed
 */
export function combineStructureData(filteredResults) {
  const structureIssues = [
    ...filteredResults.lang.issues,
    ...filteredResults.landmarks.issues,
    ...filteredResults.buttons.issues,
  ];

  return {
    total:
      filteredResults.lang.total +
      filteredResults.landmarks.total +
      filteredResults.buttons.total,
    issues: structureIssues,
    passed:
      filteredResults.lang.passed +
      filteredResults.landmarks.passed +
      filteredResults.buttons.passed,
  };
}
