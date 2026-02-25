// Popup script pour afficher les résultats de l'audit

import { TIMEOUTS, SCORES } from "../utils/constants.js";
import {
  generateGitHubMarkdown,
  copyMarkdownToClipboard,
} from "../utils/markdown.js";
import {
  getMdnLinks,
  generateIssueHTML,
  combineStructureData,
} from "./popup-utils.js";

// État des filtres actifs
const activeFilters = {
  images: true,
  svg: true,
  links: true,
  headings: true,
  forms: true,
  colorblind: true,
  structure: true,
  buttons: true,
  contrast: true,
};

// Stocker les résultats complets pour pouvoir les filtrer
let fullResults = null;

document.addEventListener("DOMContentLoaded", function () {
  // Initialiser le mode dark
  initDarkMode();

  runAudit();

  // Handler for markers clear button
  document
    .getElementById("clearMarkersBtn")
    .addEventListener("click", clearMarkers);

  // Handlers for filters
  setupFilterHandlers();

  // Handler for dark mode toggle
  document
    .getElementById("toggle-dark-mode")
    .addEventListener("click", toggleDarkMode);
});

async function clearMarkers() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    chrome.tabs.sendMessage(
      tab.id,
      { action: "clearVisualFeedback" },
      function (_response) {
        if (chrome.runtime.lastError) {
          console.error("Erreur:", chrome.runtime.lastError);
          return;
        }
        // Visual confirmation (optional)
        const btn = document.getElementById("clearMarkersBtn");
        const originalText = btn.textContent;
        btn.textContent = "✓ Marqueurs effacés";
        setTimeout(() => {
          btn.textContent = originalText;
        }, TIMEOUTS.FEEDBACK_MESSAGE);
      },
    );
  } catch (error) {
    console.error("Erreur lors du nettoyage:", error);
  }
}

/**
 * Applique un feedback visuel sur un bouton selon le résultat de l'action
 * @param {HTMLElement} button - Le bouton à modifier
 * @param {boolean} success - true si succès, false si échec
 */
function applyButtonFeedback(button, success) {
  if (!button) {
    return;
  }

  const originalText = button.textContent;
  const originalClass = button.className;

  if (success) {
    button.className = "goto-btn goto-success";
    button.textContent = "✓ Élément trouvé";
  } else {
    button.className = "goto-btn goto-error";
    button.textContent = "✗ Élément introuvable";
  }

  // Réinitialiser après 3 secondes
  setTimeout(() => {
    button.textContent = originalText;
    button.className = originalClass;
  }, TIMEOUTS.FEEDBACK_MESSAGE);
}

async function navigateToImage(imageId, buttonElement) {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    chrome.tabs.sendMessage(
      tab.id,
      { action: "scrollToImage", imageId: imageId },
      function (response) {
        if (chrome.runtime.lastError) {
          console.error("Erreur:", chrome.runtime.lastError);
          applyButtonFeedback(buttonElement, false);
          return;
        }
        // Capturer le résultat du scrollTo
        applyButtonFeedback(buttonElement, response?.success);
      },
    );
  } catch (error) {
    console.error("Erreur lors de la navigation:", error);
    applyButtonFeedback(buttonElement, false);
  }
}

async function navigateToLink(linkId, buttonElement) {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    chrome.tabs.sendMessage(
      tab.id,
      { action: "scrollToLink", linkId: linkId },
      function (response) {
        if (chrome.runtime.lastError) {
          console.error("Erreur:", chrome.runtime.lastError);
          applyButtonFeedback(buttonElement, false);
          return;
        }
        applyButtonFeedback(buttonElement, response?.success);
      },
    );
  } catch (error) {
    console.error("Erreur lors de la navigation:", error);
    applyButtonFeedback(buttonElement, false);
  }
}

function copyGitHubMarkdown(issue, category, buttonElement) {
  const markdown = generateGitHubMarkdown(issue, category, getMdnLinks);
  copyMarkdownToClipboard(markdown, buttonElement, "✓ Copié !");
}

async function navigateToSVG(svgId, buttonElement) {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    chrome.tabs.sendMessage(
      tab.id,
      { action: "scrollToSVG", svgId: svgId },
      function (response) {
        if (chrome.runtime.lastError) {
          console.error("Erreur:", chrome.runtime.lastError);
          applyButtonFeedback(buttonElement, false);
          return;
        }
        applyButtonFeedback(buttonElement, response?.success);
      },
    );
  } catch (error) {
    console.error("Erreur lors de la navigation:", error);
    applyButtonFeedback(buttonElement, false);
  }
}

async function navigateToHeading(headingId, buttonElement) {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    chrome.tabs.sendMessage(
      tab.id,
      { action: "scrollToHeading", headingId: headingId },
      function (response) {
        if (chrome.runtime.lastError) {
          console.error("Erreur:", chrome.runtime.lastError);
          applyButtonFeedback(buttonElement, false);
          return;
        }
        applyButtonFeedback(buttonElement, response?.success);
      },
    );
  } catch (error) {
    console.error("Erreur lors de la navigation:", error);
    applyButtonFeedback(buttonElement, false);
  }
}

async function navigateToForm(formId, buttonElement) {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    chrome.tabs.sendMessage(
      tab.id,
      { action: "scrollToForm", formId: formId },
      function (response) {
        if (chrome.runtime.lastError) {
          console.error("Erreur:", chrome.runtime.lastError);
          applyButtonFeedback(buttonElement, false);
          return;
        }
        applyButtonFeedback(buttonElement, response?.success);
      },
    );
  } catch (error) {
    console.error("Erreur lors de la navigation:", error);
    applyButtonFeedback(buttonElement, false);
  }
}

async function navigateToButton(buttonId, buttonElement) {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    chrome.tabs.sendMessage(
      tab.id,
      { action: "scrollToButton", buttonId: buttonId },
      function (response) {
        if (chrome.runtime.lastError) {
          console.error("Erreur:", chrome.runtime.lastError);
          applyButtonFeedback(buttonElement, false);
          return;
        }
        applyButtonFeedback(buttonElement, response?.success);
      },
    );
  } catch (error) {
    console.error("Erreur lors de la navigation:", error);
    applyButtonFeedback(buttonElement, false);
  }
}

async function navigateToContrast(contrastId, buttonElement) {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    chrome.tabs.sendMessage(
      tab.id,
      { action: "scrollToContrast", contrastId: contrastId },
      function (response) {
        if (chrome.runtime.lastError) {
          console.error("Erreur:", chrome.runtime.lastError);
          applyButtonFeedback(buttonElement, false);
          return;
        }
        applyButtonFeedback(buttonElement, response?.success);
      },
    );
  } catch (error) {
    console.error("Erreur lors de la navigation:", error);
    applyButtonFeedback(buttonElement, false);
  }
}

// Fonction pour appliquer un filtre de daltonisme
async function applyColorblindFilter(filterType) {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    chrome.tabs.sendMessage(
      tab.id,
      { action: "applyColorblindFilter", filterType: filterType },
      function (_response) {
        if (chrome.runtime.lastError) {
          console.error("Erreur:", chrome.runtime.lastError);
          return;
        }
      },
    );
  } catch (error) {
    console.error("Erreur lors de l'application du filtre:", error);
  }
}

async function runAudit() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    // Vérifier si le script est déjà injecté en testant la communication
    chrome.tabs.sendMessage(
      tab.id,
      { action: "ping" },
      async function (response) {
        // Si pas de réponse, le script n'est pas injecté
        if (chrome.runtime.lastError || !response) {
          // Inject content script
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ["src/content/content.js"],
            });

            // Attendre que le script soit prêt puis lancer l'audit
            setTimeout(() => {
              launchAudit(tab.id);
            }, 100);
          } catch (injectionError) {
            showError(
              `Erreur d'injection du script: ${injectionError.message}`,
            );
          }
        } else {
          // Le script est déjà injecté, lancer l'audit directement
          launchAudit(tab.id);
        }
      },
    );
  } catch (error) {
    showError(`Erreur lors de l'analyse: ${error.message}`);
  }
}

function launchAudit(tabId) {
  chrome.tabs.sendMessage(tabId, { action: "runAudit" }, function (response) {
    if (chrome.runtime.lastError) {
      showError(
        "Erreur: Impossible d'analyser cette page. Actualisez la page et réessayez.",
      );
      return;
    }

    if (response && response.results) {
      // Stocker les résultats complets
      fullResults = response.results;
      displayResults(response.results);
    }
  });
}

function displayResults(results) {
  document.getElementById("loading").style.display = "none";
  document.getElementById("results").style.display = "block";

  // Stocker les résultats complets
  fullResults = results;

  // Filtrer les résultats selon les filtres actifs
  const filteredResults = filterResults(results);

  // Calculer et afficher le score
  const score = calculateAndDisplayScore(filteredResults);

  // Appliquer la couleur au score
  const scoreElement = document.getElementById("totalScore");
  applyScoreColor(scoreElement, score);

  // Gérer la visibilité des catégories
  toggleCategoriesVisibility();

  // Afficher les résultats par catégorie
  displayCategory(
    "images",
    filteredResults.images,
    "imagesContent",
    "imagesBadge",
  );
  displayCategory("svg", filteredResults.svg, "svgContent", "svgBadge");
  displayCategory("links", filteredResults.links, "linksContent", "linksBadge");
  displayCategory(
    "headings",
    filteredResults.headings,
    "headingsContent",
    "headingsBadge",
  );
  displayCategory("forms", filteredResults.forms, "formsContent", "formsBadge");
  displayCategory(
    "contrast",
    filteredResults.contrast,
    "contrastContent",
    "contrastBadge",
  );

  // Attacher les listeners du simulateur de daltonisme
  attachColorblindListeners();

  // Afficher la catégorie structure combinée
  const structureData = combineStructureData(filteredResults);
  displayCategory(
    "structure",
    structureData,
    "structureContent",
    "structureBadge",
  );

  // Export button
  document
    .getElementById("exportBtn")
    .addEventListener("click", () => exportReport(filteredResults, score));

  // Attacher les gestionnaires de switches
  attachSwitchHandlers();
}

// Calculer et afficher le score global
function calculateAndDisplayScore(filteredResults) {
  let totalIssues = 0;
  let totalTests = 0;

  Object.values(filteredResults).forEach((category) => {
    totalIssues += category.issues.length;
    totalTests += category.total;
  });

  const score =
    totalTests > 0 ? Math.round((1 - totalIssues / totalTests) * 100) : 100;

  document.getElementById("totalScore").textContent = `${score}%`;
  document.getElementById("totalPassed").textContent = totalTests - totalIssues;
  document.getElementById("totalFailed").textContent = totalIssues;

  return score;
}

// Appliquer la couleur au score selon les seuils
function applyScoreColor(scoreElement, score) {
  if (score >= SCORES.GOOD_THRESHOLD) {
    scoreElement.style.color = "#10b981";
  } else if (score >= SCORES.MEDIUM_THRESHOLD) {
    scoreElement.style.color = "#f59e0b";
  } else {
    scoreElement.style.color = "#ef4444";
  }
}

// Gérer la visibilité des catégories selon les filtres actifs
function toggleCategoriesVisibility() {
  document.getElementById("imagesCategory").style.display = activeFilters.images
    ? "block"
    : "none";
  document.getElementById("svgCategory").style.display = activeFilters.svg
    ? "block"
    : "none";
  document.getElementById("linksCategory").style.display = activeFilters.links
    ? "block"
    : "none";
  document.getElementById("headingsCategory").style.display =
    activeFilters.headings ? "block" : "none";
  document.getElementById("formsCategory").style.display = activeFilters.forms
    ? "block"
    : "none";
  document.getElementById("contrastCategory").style.display =
    activeFilters.contrast ? "block" : "none";
  document.getElementById("colorblindCategory").style.display = "block";
  document.getElementById("structureCategory").style.display =
    activeFilters.structure || activeFilters.buttons ? "block" : "none";
}

// Attacher les event listeners pour le simulateur de daltonisme
function attachColorblindListeners() {
  document.querySelectorAll(".colorblind-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const filterType = btn.getAttribute("data-filter");
      applyColorblindFilter(filterType);

      // Feedback visuel
      document
        .querySelectorAll(".colorblind-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });
}

// Configuration des handlers de navigation par catégorie
const NAVIGATION_CONFIG = {
  images: { attr: "data-image-id", handler: navigateToImage },
  links: { attr: "data-link-id", handler: navigateToLink },
  svg: { attr: "data-svg-id", handler: navigateToSVG },
  headings: { attr: "data-heading-id", handler: navigateToHeading },
  forms: { attr: "data-form-id", handler: navigateToForm },
  structure: { attr: "data-button-id", handler: navigateToButton },
  contrast: { attr: "data-contrast-id", handler: navigateToContrast },
};

// Attacher les event listeners pour les boutons de navigation
function attachNavigationListeners(contentElement, name) {
  const config = NAVIGATION_CONFIG[name];
  if (!config) {
    return;
  }

  contentElement.querySelectorAll(".goto-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const elementId = btn.getAttribute(config.attr);
      if (elementId) {
        config.handler(elementId, btn); // Passer le bouton pour le feedback visuel
      }
    });
  });
}

// Attacher les event listeners pour les boutons Markdown
function attachMarkdownListeners(contentElement, data) {
  contentElement.querySelectorAll(".markdown-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const issueIndex = parseInt(btn.getAttribute("data-issue-index"));
      const category = btn.getAttribute("data-category");
      const issue = data.issues[issueIndex];
      copyGitHubMarkdown(issue, category, btn);
    });
  });
}

// Attacher les event listeners pour les liens "Ressources"
function attachResourcesListeners(contentElement) {
  contentElement.querySelectorAll(".toggle-resources-link").forEach((btn) => {
    btn.addEventListener("click", () => {
      const resourcesId = btn.getAttribute("data-resources-id");
      const resourcesElement = document.getElementById(resourcesId);
      const textElement = btn.querySelector(".resources-text");

      if (resourcesElement.style.display === "none") {
        resourcesElement.style.display = "block";
        textElement.textContent = "Masquer";
        btn.classList.add("active");
      } else {
        resourcesElement.style.display = "none";
        textElement.textContent = "Ressources";
        btn.classList.remove("active");
      }
    });
  });
}

// Attacher les event listeners pour les boutons "Voir le code HTML"
function attachCodeSnippetListeners(contentElement) {
  contentElement.querySelectorAll(".toggle-code-snippet").forEach((btn) => {
    btn.addEventListener("click", () => {
      const snippetId = btn.getAttribute("data-snippet-id");
      const snippetElement = document.getElementById(snippetId);
      const textElement = btn.querySelector("span");

      if (snippetElement.style.display === "none") {
        snippetElement.style.display = "block";
        textElement.textContent = "Masquer le code";
        btn.classList.add("active");
      } else {
        snippetElement.style.display = "none";
        textElement.textContent = "Voir le code HTML";
        btn.classList.remove("active");
      }
    });
  });
}

// Mettre à jour le badge d'une catégorie
function updateCategoryBadge(badgeElement, issuesCount) {
  badgeElement.textContent = issuesCount;

  if (issuesCount > 0) {
    badgeElement.classList.add("badge-error");
  } else {
    badgeElement.classList.add("badge-success");
  }
}

function displayCategory(name, data, contentId, badgeId) {
  const contentElement = document.getElementById(contentId);
  const badgeElement = document.getElementById(badgeId);

  // Mettre à jour le badge
  updateCategoryBadge(badgeElement, data.issues.length);

  // Afficher le disclaimer pour le contraste si présent
  let disclaimerHTML = "";
  if (name === "contrast" && data.disclaimer) {
    disclaimerHTML = `<div class="contrast-disclaimer">${data.disclaimer}</div>`;
  }

  // Afficher le message de succès ou les issues
  if (data.issues.length === 0) {
    contentElement.innerHTML = `${disclaimerHTML}<p class="success-message">✅ Aucun problème détecté</p>`;
    return;
  }

  // Générer le HTML pour toutes les issues
  const issuesHTML = data.issues
    .map((issue, issueIndex) => generateIssueHTML(issue, issueIndex, name))
    .join("");

  contentElement.innerHTML = `${disclaimerHTML}${issuesHTML}`;

  // Attacher tous les event listeners
  attachNavigationListeners(contentElement, name);
  attachMarkdownListeners(contentElement, data);
  attachResourcesListeners(contentElement);
  attachCodeSnippetListeners(contentElement);
}

function showError(message) {
  document.getElementById("loading").style.display = "none";
  document.getElementById("results").innerHTML = `
    <div class="error-message">
      <p>⚠️ ${message}</p>
    </div>
  `;
  document.getElementById("results").style.display = "block";
}

function exportReport(results, score) {
  const reportDate = new Date().toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const reportTime = new Date().toLocaleTimeString("fr-FR");

  // Obtenir l'URL de la page auditée
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const pageUrl = tabs[0]?.url || "Page inconnue";
    const pageTitle = tabs[0]?.title || "Sans titre";

    // Stocker les données du rapport dans session storage
    const reportData = {
      results,
      score,
      pageUrl,
      pageTitle,
      reportDate,
      reportTime,
    };

    chrome.storage.session.set({ reportData }, function () {
      // Ouvrir la page de rapport
      const reportUrl = chrome.runtime.getURL("src/report/report.html");
      chrome.tabs.create({ url: reportUrl });
    });
  });
}

/**
 * Applique un filtre à une catégorie de résultats
 * @param {boolean} isActive - Le filtre est-il actif ?
 * @param {Object} resultData - Les données de la catégorie
 * @returns {Object} - Les données si actif, sinon un objet vide
 */
function applyFilter(isActive, resultData) {
  return isActive ? resultData : { total: 0, issues: [], passed: 0 };
}

/**
 * Filtre les résultats selon les filtres actifs
 * Utilise applyFilter pour réduire la complexité
 * @param {Object} results - Résultats complets de l'audit
 * @returns {Object} - Résultats filtrés
 */
function filterResults(results) {
  return {
    images: applyFilter(activeFilters.images, results.images),
    svg: applyFilter(activeFilters.svg, results.svg),
    links: applyFilter(activeFilters.links, results.links),
    headings: applyFilter(activeFilters.headings, results.headings),
    forms: applyFilter(activeFilters.forms, results.forms),
    contrast: applyFilter(activeFilters.contrast, results.contrast),
    colorblind: applyFilter(activeFilters.colorblind, results.colorblind),
    lang: applyFilter(activeFilters.structure, results.lang),
    landmarks: applyFilter(activeFilters.structure, results.landmarks),
    buttons: applyFilter(activeFilters.buttons, results.buttons),
  };
}

// Fonction pour configurer les gestionnaires de filtres
function setupFilterHandlers() {
  // Cette fonction sera appelée après l'affichage des résultats
  // pour attacher les gestionnaires aux switches dans les headers
}

// Fonction pour ajouter les gestionnaires de switches dans les headers
function attachSwitchHandlers() {
  const checkboxes = document.querySelectorAll(".audit-filter");
  console.log("Attaching handlers to", checkboxes.length, "switches");

  checkboxes.forEach((checkbox, index) => {
    // Supprimer tout event listener existant en utilisant un attribut data
    if (checkbox.dataset.handlerAttached === "true") {
      console.log("Handler already attached to checkbox", index);
      return;
    }

    checkbox.dataset.handlerAttached = "true";

    // Utiliser addEventListener avec capture pour être sûr de capturer l'événement
    checkbox.addEventListener(
      "change",
      function (e) {
        e.stopPropagation(); // Empêcher la propagation au header

        const category = this.getAttribute("data-category");
        const categoryElement = document.getElementById(`${category}Category`);
        const isChecked = this.checked;

        console.log("===== Switch changed =====");
        console.log("Category:", category);
        console.log("Is checked:", isChecked);
        console.log("Current activeFilters before update:", {
          ...activeFilters,
        });

        if (isChecked) {
          // Réactiver la catégorie
          categoryElement.classList.remove("disabled");
          activeFilters[category] = true;
          console.log("✅ ACTIVATING", category);
        } else {
          // Désactiver la catégorie
          categoryElement.classList.add("disabled");
          activeFilters[category] = false;
          console.log("❌ DEACTIVATING", category);
        }

        console.log("Active filters after update:", { ...activeFilters });
        console.log("=========================");

        // Mettre à jour le score global
        updateScore();

        // Mettre à jour les marqueurs visuels
        updateVisualMarkers();
      },
      true,
    ); // Utiliser capture phase

    console.log(
      "Handler attached to checkbox",
      index,
      "for category",
      checkbox.getAttribute("data-category"),
    );
  });
}

// Fonction pour recalculer et afficher le score global
function updateScore() {
  if (!fullResults) {
    return;
  }

  const filteredResults = filterResults(fullResults);

  let totalIssues = 0;
  let totalTests = 0;

  Object.values(filteredResults).forEach((category) => {
    totalIssues += category.issues.length;
    totalTests += category.total;
  });

  const score =
    totalTests > 0 ? Math.round((1 - totalIssues / totalTests) * 100) : 100;

  // Display score
  document.getElementById("totalScore").textContent = `${score}%`;
  document.getElementById("totalPassed").textContent = totalTests - totalIssues;
  document.getElementById("totalFailed").textContent = totalIssues;

  // Color the score
  const scoreElement = document.getElementById("totalScore");
  if (score >= SCORES.GOOD_THRESHOLD) {
    scoreElement.style.color = "#10b981";
  } else if (score >= SCORES.MEDIUM_THRESHOLD) {
    scoreElement.style.color = "#f59e0b";
  } else {
    scoreElement.style.color = "#ef4444";
  }
}

// Fonction pour mettre à jour les marqueurs visuels selon les filtres
async function updateVisualMarkers() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    chrome.tabs.sendMessage(
      tab.id,
      { action: "updateFilters", filters: activeFilters },
      function (_response) {
        if (chrome.runtime.lastError) {
          console.error("Erreur:", chrome.runtime.lastError);
          return;
        }
      },
    );
  } catch (error) {
    console.error("Erreur lors de la mise à jour des marqueurs:", error);
  }
}

// ==================== MODE DARK ====================

// Initialiser le mode dark depuis le stockage
function initDarkMode() {
  chrome.storage.sync.get(["darkMode"], function (result) {
    if (result.darkMode) {
      document.body.classList.add("dark-mode");
    }
  });
}

// Basculer le mode dark
function toggleDarkMode() {
  const isDarkMode = document.body.classList.toggle("dark-mode");

  // Sauvegarder la préférence
  chrome.storage.sync.set({ darkMode: isDarkMode });
}
