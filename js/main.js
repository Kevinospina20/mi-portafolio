import { loadContent, subscribeToContent } from "./content.js";
import { loadRepositories, renderRepositories } from "./github.js";

const iconPaths = {
  Instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>',
  Discord: '<path d="M8 8.5a4.4 4.4 0 0 1 8 0"/><path d="M5 9c2-2 4-3 7-3s5 1 7 3l1 9a2 2 0 0 1-2 2l-2-1-1-2h-6l-1 2-2 1a2 2 0 0 1-2-2l1-9Z"/><circle cx="9" cy="13" r=".8"/><circle cx="15" cy="13" r=".8"/>',
  LinkedIn: '<path d="M4 9v11M4 4v.01M9 20v-7a4 4 0 0 1 8 0v7M9 10v10"/><path d="M4 9h.01"/>',
  GitHub: '<path d="M9 19c-4 1.5-4-2.5-6-3m12 6v-3.9a3.4 3.4 0 0 0-1-2.6c3.3-.4 6.8-1.6 6.8-7.2a5.6 5.6 0 0 0-1.5-3.9 5.2 5.2 0 0 0-.1-3.9S18 1.1 15 3a13.5 13.5 0 0 0-7 0C5 1.1 3.8 2.5 3.8 2.5a5.2 5.2 0 0 0-.1 3.9 5.6 5.6 0 0 0-1.5 3.9c0 5.6 3.5 6.8 6.8 7.2a3.4 3.4 0 0 0-1 2.6V22"/>',
};

const navButtons = [...document.querySelectorAll(".nav-link")];
const panels = [...document.querySelectorAll("[data-view-panel]")];
const menuToggle = document.querySelector(".menu-toggle");
const nav = document.querySelector(".nav");
let portfolioRenderRevision = 0;

function setView(view) {
  const selected = panels.some((panel) => panel.dataset.viewPanel === view) ? view : "inicio";
  panels.forEach((panel) => {
    const active = panel.dataset.viewPanel === selected;
    panel.hidden = !active;
    panel.classList.toggle("active", active);
  });
  navButtons.forEach((button) => {
    const active = button.dataset.view === selected;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  document.body.dataset.section = selected;
  history.replaceState(null, "", `#${selected}`);
  nav.classList.remove("open");
  menuToggle.setAttribute("aria-expanded", "false");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

navButtons.forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
document.querySelectorAll("[data-navigate]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.navigate)));
menuToggle.addEventListener("click", () => {
  const open = menuToggle.getAttribute("aria-expanded") !== "true";
  menuToggle.setAttribute("aria-expanded", String(open));
  nav.classList.toggle("open", open);
});
document.addEventListener("keydown", (event) => { if (event.key === "Escape") { nav.classList.remove("open"); menuToggle.setAttribute("aria-expanded", "false"); } });

const themeToggle = document.querySelector(".theme-toggle");
function setTheme(light) {
  document.body.classList.toggle("light", light);
  themeToggle.setAttribute("aria-label", light ? "Cambiar a tema oscuro" : "Cambiar a tema claro");
  try { localStorage.setItem("portfolio-theme", light ? "light" : "dark"); } catch { /* El tema sigue funcionando aunque el almacenamiento esté bloqueado. */ }
}
try { setTheme(localStorage.getItem("portfolio-theme") === "light"); } catch { setTheme(false); }
themeToggle.addEventListener("click", () => setTheme(!document.body.classList.contains("light")));

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function renderTimeline(target, entries, emptyMessage) {
  if (!Array.isArray(entries) || entries.length === 0) {
    target.innerHTML = `<p class="empty-timeline">${emptyMessage}</p>`;
    return;
  }
  target.innerHTML = entries.map((entry) => `<article class="timeline-entry"><span class="timeline-date">${escapeHTML(entry.period || "")}</span><h3>${escapeHTML(entry.title || "")}</h3><span class="timeline-org">${escapeHTML(entry.organization || "")}</span>${entry.description ? `<p>${escapeHTML(entry.description)}</p>` : ""}</article>`).join("");
}

function renderSkills(skills) {
  const target = document.getElementById("skills-list");
  const rows = Array.isArray(skills) ? skills : [];
  if (!rows.length) { target.innerHTML = '<p class="empty-timeline">Añade tus habilidades en js/config.js</p>'; return; }
  let currentGroup = "";
  target.innerHTML = rows.map((skill) => {
    const group = escapeHTML(skill.group || "HABILIDADES");
    const heading = group !== currentGroup ? `<p class="skill-group">${group}</p>` : "";
    currentGroup = group;
    const level = Math.min(100, Math.max(0, Number(skill.level) || 0));
    return `${heading}<div class="skill-item"><div class="skill-label"><span>${escapeHTML(skill.name)}</span><span>${level}%</span></div><div class="skill-track"><div class="skill-fill" style="width:${level}%"></div></div></div>`;
  }).join("");
}

function renderSocials(socials, username) {
  const usable = (Array.isArray(socials) ? socials : []).filter((social) => /^https:\/\//i.test(social.url || ""));
  const github = usable.find((item) => item.name === "GitHub");
  if (!github && username && username !== "TU_USUARIO_GITHUB") usable.push({ name: "GitHub", handle: "Código e ideas", url: `https://github.com/${encodeURIComponent(username)}`, color: "lime" });
  const finalList = [...new Map(usable.map((social) => [social.name, social])).values()];
  const placeholders = ["Instagram", "Discord", "LinkedIn"].filter((name) => !finalList.some((social) => social.name === name)).map((name) => ({ name, handle: "Añade tu enlace en js/config.js", url: "", color: name === "Instagram" ? "coral" : name === "Discord" ? "violet" : "blue" }));
  const markup = [...finalList, ...placeholders].map((social) => {
    const icon = iconPaths[social.name] || iconPaths.GitHub;
    const row = `<span class="social-icon"><svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg></span><span class="social-info"><strong>${escapeHTML(social.name)}</strong><small>${escapeHTML(social.handle || "")}</small></span><span class="social-arrow">${social.url ? "↗" : "＋"}</span>`;
    const style = `--social-color:var(--${escapeHTML(social.color || "lime")});--social-soft:color-mix(in srgb,var(--${escapeHTML(social.color || "lime")}) 12%,transparent)`;
    return social.url ? `<a class="social-row" href="${escapeHTML(social.url)}" target="_blank" rel="noreferrer" style="${style}">${row}</a>` : `<div class="social-row social-row-placeholder" style="${style}">${row}</div>`;
  }).join("");
  document.getElementById("social-list").innerHTML = markup;
  document.getElementById("mini-socials").innerHTML = finalList.map((social) => `<a class="mini-social" href="${escapeHTML(social.url)}" target="_blank" rel="noreferrer" aria-label="${escapeHTML(social.name)}"><svg viewBox="0 0 24 24" aria-hidden="true">${iconPaths[social.name] || iconPaths.GitHub}</svg></a>`).join("");
}

async function renderPortfolio(content) {
  const revision = ++portfolioRenderRevision;
  const profile = content.profile || {};
  document.querySelectorAll("[data-profile]").forEach((element) => {
    const value = profile[element.dataset.profile];
    if (value) element.textContent = value;
  });
  document.querySelectorAll("[data-stat]").forEach((element) => {
    const value = profile.stats?.[element.dataset.stat];
    if (value) element.textContent = value;
  });
  document.querySelector("[data-monogram]").innerHTML = `${escapeHTML((profile.firstName || "K").trim().charAt(0).toLowerCase())}<span>.</span>`;
  document.title = `${profile.name || "Portafolio"} — Portafolio & hoja de vida`;
  const emailLink = document.querySelector("[data-email-link]");
  if (profile.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
    emailLink.href = `mailto:${profile.email}`;
    emailLink.onclick = null;
  } else {
    emailLink.href = "#";
    emailLink.onclick = (event) => { event.preventDefault(); showToast("Añade tu correo en el panel de administración para activar este enlace."); };
  }
  renderTimeline(document.getElementById("experience-list"), profile.experience, "Añade tus experiencias en js/config.js para construir tu recorrido.");
  renderTimeline(document.getElementById("education-list"), profile.education, "Añade tus estudios en js/config.js para completar esta sección.");
  renderSkills(profile.skills);
  renderSocials(content.socials, content.githubUsername);
  const result = await loadRepositories(content.githubUsername);
  if (revision === portfolioRenderRevision) renderRepositories(result, document.getElementById("repo-grid"), document.getElementById("github-note"), document.getElementById("repo-count"));
}

async function initialize() {
  let liveEvents = 0;
  try { await subscribeToContent((content) => { liveEvents += 1; void renderPortfolio(content); }); }
  catch (error) { console.info("Actualización en vivo no disponible; el perfil se carga desde Supabase al abrir la página.", error); }
  const eventCountBeforeRead = liveEvents;
  const content = await loadContent();
  if (eventCountBeforeRead === liveEvents) await renderPortfolio(content);
}

let toastTimer;
function showToast(message) {
  const toast = document.querySelector(".toast");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 3000);
}

document.getElementById("current-year").textContent = new Date().getFullYear();
setView(location.hash.slice(1) || "inicio");
initialize();
