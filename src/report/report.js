// Attendre que le DOM soit chargé
window.addEventListener("DOMContentLoaded", async function () {
  try {
    // Récupérer les données du rapport depuis le session storage
    const result = await chrome.storage.session.get(["reportData"]);

    if (result.reportData) {
      const data = result.reportData;
      renderReport(data);
    } else {
      document.getElementById("reportContent").innerHTML =
        '<p style="color: red; text-align: center;">Erreur : Aucune donnée de rapport trouvée.</p>';
    }
  } catch (error) {
    console.error("Erreur lors de la récupération des données:", error);
    document.getElementById("reportContent").innerHTML =
      '<p style="color: red; text-align: center;">Erreur : Impossible de charger les données du rapport.</p>';
  }
});

function renderReport(data) {
  const { results, score, pageUrl, pageTitle, reportDate, reportTime } = data;

  const categoryNames = {
    images: "Images",
    svg: "SVG Inline",
    links: "Liens",
    headings: "Titres",
    forms: "Formulaires",
    lang: "Langue",
    landmarks: "Structure",
    buttons: "Boutons",
  };

  const totalPassed = Object.values(results).reduce(
    (sum, cat) => sum + cat.passed,
    0,
  );
  const totalFailed = Object.values(results).reduce(
    (sum, cat) => sum + cat.issues.length,
    0,
  );

  const html = `
    <div class="header">
      <h1>
        <img src="${chrome.runtime.getURL("icon48.png")}" alt="Logo QuickA11y" style="width: 32px; height: 32px;">
        QuickA11y - Rapport d'Audit d'Accessibilité Web
      </h1>
      <p>Analyse complète des critères WCAG</p>
    </div>
    
    <div class="meta-info">
      <p><strong>Page analysée :</strong> ${pageTitle}</p>
      <p><strong>URL :</strong> ${pageUrl}</p>
      <p><strong>Date de l'audit :</strong> ${reportDate} à ${reportTime}</p>
    </div>
    
    <div class="score-section">
      <div class="score-number">${score}%</div>
      <div class="score-label">Score d'accessibilité global</div>
    </div>
    
    <div class="stats">
      <div class="stat">
        <div class="stat-value">${totalPassed}</div>
        <div class="stat-label">Tests réussis</div>
      </div>
      <div class="stat">
        <div class="stat-value">${totalFailed}</div>
        <div class="stat-label">Problèmes détectés</div>
      </div>
    </div>
    
    ${Object.entries(results)
      .filter(([category]) => category !== "colorblind")
      .map(([category, data]) => {
        const categoryName = categoryNames[category] || category;
        const badgeClass = data.issues.length === 0 ? "success" : "warning";
        const badgeText =
          data.issues.length === 0
            ? "✓ Aucun problème"
            : `${data.issues.length} problème${data.issues.length > 1 ? "s" : ""}`;

        return `
    <div class="category">
      <div class="category-header">
        <h2 class="category-title">${categoryName}</h2>
        <span class="category-badge ${badgeClass}">${badgeText}</span>
      </div>
      <div class="category-content">
        ${
          data.issues.length > 0
            ? data.issues
                .map((issue) => {
                  // Construire la section des ressources utiles
                  const resources = [];
                  if (issue.src) {
                    resources.push(
                      `<strong>Source :</strong> <code>${issue.src}</code>`,
                    );
                  }
                  if (issue.href) {
                    resources.push(
                      `<strong>URL du lien :</strong> <code>${issue.href}</code>`,
                    );
                  }
                  if (issue.text) {
                    resources.push(`<strong>Texte :</strong> "${issue.text}"`);
                  }
                  if (issue.type) {
                    resources.push(`<strong>Type :</strong> ${issue.type}`);
                  }

                  const resourcesHtml =
                    resources.length > 0
                      ? `<div class="issue-resources"><strong>📋 Ressources utiles :</strong><br>${resources.join("<br>")}</div>`
                      : "";

                  return `
          <div class="issue ${issue.severity}">
            <div class="issue-header">
              <span class="issue-element">${issue.element}</span>
              <span class="severity-badge ${issue.severity}">${issue.severity}</span>
            </div>
            <p class="issue-description">${issue.issue}</p>
            ${issue.explanation ? `<div class="issue-explanation">${issue.explanation}</div>` : ""}
            ${resourcesHtml}
          </div>
        `;
                })
                .join("")
            : '<p class="success-message">✅ Aucun problème détecté</p>'
        }
      </div>
    </div>
        `;
      })
      .join("")}
    
    <div class="footer">
      <p>
        <img src="${chrome.runtime.getURL("icon48.png")}" alt="Logo" style="width: 20px; height: 20px; vertical-align: middle; margin-right: 8px;">
        <strong>© QuickA11y - Accessibilité Web</strong>
      </p>
      <p>Généré le ${reportDate} à ${reportTime}</p>
    </div>
  `;

  document.getElementById("reportContent").innerHTML = html;

  // Gérer le bouton d'impression (après le rendu)
  const printBtn = document.getElementById("printBtn");
  if (printBtn) {
    printBtn.addEventListener("click", function () {
      window.print();
    });
  }
}
