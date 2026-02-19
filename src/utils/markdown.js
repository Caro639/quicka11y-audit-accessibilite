// Utilities for GitHub Markdown generation

import { CATEGORY_NAMES, PRIORITY_EMOJIS, TIMEOUTS } from "./constants.js";

/**
 * Generate Markdown report header
 */
function generateMarkdownHeader(issue, category) {
  const categoryName = CATEGORY_NAMES[category] || category;
  const priorityEmoji = PRIORITY_EMOJIS[issue.severity] || "⚪";

  let markdown = `## ${priorityEmoji} [Accessibilité] ${issue.issue}\n\n`;
  markdown += `**Type :** ${categoryName}\n`;
  markdown += `**Priorité :** ${issue.severity}\n`;
  markdown += `**Élément :** ${issue.element}\n\n`;

  return markdown;
}

/**
 * Generate problem description section
 */
function generateProblemDescription(issue) {
  let markdown = `### 📋 Description du problème\n\n`;
  markdown += `${issue.issue}\n\n`;

  if (issue.explanation) {
    markdown += `> 💡 **Impact sur l'accessibilité**\n`;
    markdown += `> \n`;
    markdown += `> ${issue.explanation}\n\n`;
  }

  return markdown;
}

/**
 * Generate technical details section
 */
function generateTechnicalDetails(issue) {
  let markdown = `### 🔍 Technical Details\n\n`;
  const details = [];

  if (issue.src) {
    details.push(`- **Source :** \`${issue.src}\``);
  }
  if (issue.href) {
    details.push(`- **Lien :** \`${issue.href}\``);
  }
  if (issue.text) {
    details.push(`- **Texte actuel :** "${issue.text}"`);
  }
  if (issue.type) {
    details.push(`- **Type :** ${issue.type}`);
  }

  markdown += `${details.join("\n")}\n\n`;
  return markdown;
}

/**
 * Generate solution suggestions based on category
 */
function generateSolution(category) {
  let markdown = `### ✅ Recommended Solution\n\n`;

  const solutions = {
    images: {
      code: `<img src="..." alt="Description de l'image" />`,
      text: "Ajouter un attribut `alt` descriptif à l'image.",
    },
    svg: {
      code: `<svg role="img" aria-label="Description du SVG">
  <!-- ou -->
  <title>Description du SVG</title>
</svg>`,
      text: 'Ajouter `role="img"` + `aria-label`, ou un élément `<title>` interne.',
    },
    links: {
      code: `<a href="..." aria-label="Description du lien">Texte du lien</a>`,
      text: "Ajouter un texte descriptif ou un attribut `aria-label`.",
    },
    headings: {
      code: null,
      text: "Respecter la hiérarchie des titres (H1 → H2 → H3).",
    },
    forms: {
      code: `<label for="input-id">Label du champ</label>
<input id="input-id" type="text" />`,
      text: "Associer un `<label>` à chaque champ de formulaire.",
    },
    structure: {
      code: null,
      text: "Vérifier la structure HTML du document (landmarks, régions ARIA).",
    },
  };

  const solution = solutions[category];
  if (solution) {
    if (solution.code) {
      markdown += `\`\`\`html\n${solution.code}\n\`\`\`\n\n`;
    }
    markdown += `${solution.text}\n`;
  }

  markdown += `\n`;
  return markdown;
}

/**
 * Generate resources section with MDN links
 */
function generateResources(category, getMdnLinksFunction) {
  let markdown = `### 📚 Resources\n\n`;

  const mdnLinks = getMdnLinksFunction(category);
  if (mdnLinks.length > 0) {
    mdnLinks.forEach((link) => {
      markdown += `- [${link.title}](${link.url})\n`;
    });
  } else {
    markdown += `- [Web Content Accessibility Guidelines (WCAG)](https://www.w3.org/WAI/WCAG21/quickref/)\n`;
  }

  markdown += `- [MDN - Accessibilité](https://developer.mozilla.org/fr/docs/Web/Accessibility)\n`;
  markdown += `\n---\n`;
  markdown += `*Rapport généré automatiquement par l'extension d'audit d'accessibilité*\n`;

  return markdown;
}

/**
 * Generate complete Markdown report for GitHub
 */
export function generateGitHubMarkdown(issue, category, getMdnLinksFunction) {
  let markdown = "";

  markdown += generateMarkdownHeader(issue, category);
  markdown += generateProblemDescription(issue);
  markdown += generateTechnicalDetails(issue);
  markdown += generateSolution(category);
  markdown += generateResources(category, getMdnLinksFunction);

  return markdown;
}

/**
 * Copy Markdown to clipboard with visual feedback
 */
export function copyMarkdownToClipboard(
  markdown,
  buttonElement,
  successMessage = "✓ Copié",
) {
  navigator.clipboard
    .writeText(markdown)
    .then(() => {
      const originalText = buttonElement.textContent;
      buttonElement.textContent = successMessage;
      buttonElement.style.backgroundColor = "#22c55e";

      setTimeout(() => {
        buttonElement.textContent = originalText;
        buttonElement.style.backgroundColor = "";
      }, TIMEOUTS.FEEDBACK_MESSAGE);
    })
    .catch((err) => {
      console.error("Erreur lors de la copie:", err);
      const originalText = buttonElement.textContent;
      buttonElement.textContent = "❌ Erreur";
      buttonElement.style.backgroundColor = "#ef4444";

      setTimeout(() => {
        buttonElement.textContent = originalText;
        buttonElement.style.backgroundColor = "";
      }, TIMEOUTS.FEEDBACK_MESSAGE);
    });
}
