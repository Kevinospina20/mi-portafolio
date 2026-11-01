import { config } from "./config.js";

const ICONS = {
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/></svg>',
  fork: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="5" r="2"/><circle cx="18" cy="19" r="2"/><circle cx="6" cy="19" r="2"/><path d="M6 7v10m12 0v-3a4 4 0 0 0-4-4H6"/></svg>',
};

export async function loadRepositories(usernameOverride = config.githubUsername) {
  const username = String(usernameOverride || config.githubUsername).trim();
  if (!username || username === "TU_USUARIO_GITHUB") return { configured: false, username, repositories: [] };
  try {
    const response = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=100&type=public`, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!response.ok) throw new Error(`GitHub respondió ${response.status}`);
    const repositories = await response.json();
    return { configured: true, username, repositories: repositories.filter((repo) => !repo.fork).slice(0, 9) };
  } catch (error) {
    console.warn("No fue posible consultar GitHub.", error);
    return { configured: true, username, repositories: null };
  }
}

export function renderRepositories(result, grid, note, count) {
  const profileLink = document.querySelector("[data-github-link]");
  if (result.username && result.username !== "TU_USUARIO_GITHUB") profileLink.href = `https://github.com/${encodeURIComponent(result.username)}`;
  if (!result.configured) {
    grid.innerHTML = `<div class="empty-repos"><span class="empty-spark">✳</span><span class="empty-label">PRIMEROS COMMITS EN CAMINO</span><h3>Este espacio está esperando<br />su primer gran proyecto.</h3><p>Cuando configures tu usuario de GitHub, tus repositorios públicos aparecerán aquí sin que tengas que mover un dedo.</p><a href="https://github.com" target="_blank" rel="noreferrer">Explorar GitHub <span>↗</span></a></div>`;
    count.textContent = "0";
    note.textContent = "Configura tu nombre de usuario en js/config.js para mostrar tu perfil.";
    return;
  }
  if (result.repositories === null) {
    grid.innerHTML = `<div class="empty-repos"><span class="empty-spark">↻</span><span class="empty-label">GITHUB NO DISPONIBLE</span><h3>No pudimos conectar<br />en este momento.</h3><p>Inténtalo más tarde o visita el perfil directamente.</p><a href="https://github.com/${encodeURIComponent(result.username)}" target="_blank" rel="noreferrer">Abrir mi perfil <span>↗</span></a></div>`;
    count.textContent = "—";
    return;
  }
  count.textContent = String(result.repositories.length);
  if (!result.repositories.length) {
    grid.innerHTML = `<div class="empty-repos"><span class="empty-spark">✳</span><span class="empty-label">AQUÍ EMPIEZA ALGO</span><h3>Mis repositorios<br />están por llegar.</h3><p>Cuando publique proyectos públicos, aparecerán aquí automáticamente. Mientras tanto, puedes conocer mi perfil.</p><a href="https://github.com/${encodeURIComponent(result.username)}" target="_blank" rel="noreferrer">Visitar mi GitHub <span>↗</span></a></div>`;
    note.textContent = "Los proyectos aparecerán automáticamente al publicarlos como repositorios públicos.";
    return;
  }
  grid.innerHTML = result.repositories.map((repo) => {
    const updated = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric" }).format(new Date(repo.updated_at));
    return `<article class="repo-card"><div class="repo-card-top"><span class="repo-glyph">⌘</span><span class="repo-visibility">${repo.private ? "Privado" : "Público"}</span></div><a class="repo-title" href="${repo.html_url}" target="_blank" rel="noreferrer">${escapeHTML(repo.name)} <span>↗</span></a><p class="repo-description">${escapeHTML(repo.description || "Un nuevo proyecto, compartido con la comunidad.")}</p><div class="repo-bottom"><span class="repo-language"><i style="--language-color:${languageColor(repo.language)}"></i>${escapeHTML(repo.language || "Proyecto")}</span><span class="repo-metric">${ICONS.star} ${repo.stargazers_count || 0}</span><span class="repo-metric">${ICONS.fork} ${repo.forks_count || 0}</span></div><div class="repo-updated">Actualizado ${updated}</div></article>`;
  }).join("");
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function languageColor(language) {
  const colors = { JavaScript: "#f1e05a", TypeScript: "#3178c6", Python: "#3572a5", HTML: "#e34c26", CSS: "#563d7c", Java: "#b07219", Go: "#00add8", Rust: "#dea584" };
  return colors[language] || "#c9f36a";
}
