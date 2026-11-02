import { loadContent, subscribeToContent } from "./content.js";
import { loadRepositories, renderRepositories } from "./github.js";
import { getCertificatePublicUrl, loadCertificates, makeCertificateDownloadUrl, subscribeToCertificates } from "./certificates.js";
import { diplomaUrl, loadDiplomas } from "./diplomas.js";

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
const navigateSection = (step) => {
  const current = Math.max(0, navButtons.findIndex((button) => button.classList.contains("active")));
  setView(navButtons[(current + step + navButtons.length) % navButtons.length].dataset.view);
};
document.getElementById("section-previous").addEventListener("click", () => navigateSection(-1));
document.getElementById("section-next").addEventListener("click", () => navigateSection(1));
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

let certificateRows = [];
const certificateGrid = document.getElementById("certificates-grid");
const certificateDialog = document.getElementById("certificate-dialog");
const certificateFrame = document.getElementById("certificate-frame");
const certificateDialogTitle = document.getElementById("certificate-dialog-title");
const certificateOpenTab = document.getElementById("certificate-open-tab");
const certificateDownload = document.getElementById("certificate-download");

function formatCertificateDate(value) {
  if (!value) return "Fecha no disponible";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric" }).format(new Date(year, month - 1, day));
}

function renderCertificates(rows, unavailable = false) {
  certificateRows = Array.isArray(rows) ? rows.filter((row) => getCertificatePublicUrl(row)) : [];
  document.getElementById("certificate-count").textContent = `PDF · ${String(certificateRows.length).padStart(2, "0")}`;
  if (unavailable) {
    certificateGrid.innerHTML = '<div class="certificate-empty"><span class="certificate-empty-icon">PDF</span><h2>La biblioteca se está preparando</h2><p>Los certificados aparecerán aquí cuando se termine de configurar el almacenamiento.</p></div>';
    return;
  }
  if (!certificateRows.length) {
    certificateGrid.innerHTML = '<div class="certificate-empty"><span class="certificate-empty-icon">PDF</span><h2>Aprendizajes por compartir</h2><p>Pronto encontrarás aquí mis certificados académicos y profesionales.</p><span class="certificate-empty-note">NUEVOS DOCUMENTOS, NUEVAS HISTORIAS</span></div>';
    return;
  }

  certificateGrid.innerHTML = certificateRows.map((certificate) => {
    const url = getCertificatePublicUrl(certificate);
    const title = escapeHTML(certificate.title || "Certificado");
    const issuer = escapeHTML(certificate.issuer || "Institución emisora");
    const date = escapeHTML(formatCertificateDate(certificate.issue_date));
    return `<article class="certificate-card"><div class="certificate-preview pdf-cover" aria-label="Documento PDF: ${title}"><span class="pdf-cover-mark">PDF</span><span class="certificate-preview-label"><span>PDF</span> VISTA PREVIA</span><span class="certificate-preview-glow"></span></div><div class="certificate-card-body"><p class="certificate-date">${date}</p><h2>${title}</h2><p class="certificate-issuer">${issuer}</p><div class="certificate-card-actions"><button class="button button-primary certificate-view-button" type="button" data-certificate-view="${escapeHTML(certificate.id)}">Ver certificado <span>↗</span></button><a class="certificate-quick-link" href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">Abrir PDF ↗</a></div></div></article>`;
  }).join("");
}

certificateGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-certificate-view]");
  if (!button) return;
  const certificate = certificateRows.find((row) => row.id === button.dataset.certificateView);
  if (!certificate) return;
  const url = getCertificatePublicUrl(certificate);
  certificateDialogTitle.textContent = certificate.title || "Certificado";
  certificateFrame.src = `${url}#toolbar=1&navpanes=0&view=FitH`;
  certificateOpenTab.href = url;
  certificateDownload.href = makeCertificateDownloadUrl(url, certificate.title);
  certificateDialog.showModal();
});

document.getElementById("certificate-dialog-close").addEventListener("click", () => certificateDialog.close());
certificateDialog.addEventListener("click", (event) => { if (event.target === certificateDialog) certificateDialog.close(); });
certificateDialog.addEventListener("close", () => { certificateFrame.removeAttribute("src"); });

async function initializeCertificates() {
  let liveEvents = 0;
  try {
    await subscribeToCertificates((rows) => { liveEvents += 1; renderCertificates(rows); });
  } catch (error) {
    console.info("Actualización en vivo de certificados no disponible.", error);
  }
  const eventCountBeforeRead = liveEvents;
  try {
    const rows = await loadCertificates();
    if (eventCountBeforeRead === liveEvents) renderCertificates(rows);
  } catch (error) {
    console.info("No se pudo cargar la lista de certificados.", error);
    renderCertificates(null, true);
  }
  try {
    const diplomas = await loadDiplomas();
    const grid = document.getElementById("diplomas-grid");
    const valid = diplomas.filter((row) => diplomaUrl(row));
    document.getElementById("diploma-count").textContent = `PDF · ${String(valid.length).padStart(2, "0")}`;
    grid.innerHTML = valid.length ? valid.map((row) => `<article class="certificate-card"><div class="certificate-preview pdf-cover" aria-label="Documento PDF: ${escapeHTML(row.title)}"><span class="pdf-cover-mark">PDF</span><span class="certificate-preview-label"><span>PDF</span> DIPLOMA</span></div><div class="certificate-card-body"><h2>${escapeHTML(row.title)}</h2><button class="button button-primary" type="button" data-open-diploma="${escapeHTML(row.id)}">Ver diploma</button></div></article>`).join("") : '<div class="certificate-empty"><h2>Aún no hay diplomas</h2></div>';
    grid.addEventListener("click", (event) => { const button = event.target.closest("[data-open-diploma]"); const row = valid.find((item) => item.id === button?.dataset.openDiploma); if (!row) return; const url = diplomaUrl(row); certificateDialogTitle.textContent = row.title; certificateFrame.src = `${url}#toolbar=1&navpanes=0&view=FitH`; certificateOpenTab.href = url; certificateDownload.href = makeCertificateDownloadUrl(url, row.title); certificateDialog.showModal(); });
  } catch { document.getElementById("diplomas-grid").innerHTML = '<div class="certificate-empty"><h2>Diplomas en preparación</h2></div>'; }
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
  try { await subscribeToContent((content) => { liveEvents += 1; void renderPortfolio(content); void renderYouTube(content.youtubeChannelId || ""); }); }
  catch (error) { console.info("Actualización en vivo no disponible; el perfil se carga desde Supabase al abrir la página.", error); }
  const eventCountBeforeRead = liveEvents;
  const content = await loadContent();
  if (eventCountBeforeRead === liveEvents) await renderPortfolio(content);
  await renderYouTube(content.youtubeChannelId || "");
}

async function renderYouTube(channelId) {
  const target = document.getElementById("youtube-content");
  if (!channelId) return;
  target.innerHTML = '<p class="certificate-loading">Cargando videos recientes…</p>';
  try {
    const currentContent = await loadContent();
    if (currentContent.youtubeApiKey) {
      const apiKey = currentContent.youtubeApiKey;
      const channelResponse = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${encodeURIComponent(channelId)}&key=${encodeURIComponent(apiKey)}`);
      const channelData = await channelResponse.json();
      if (!channelResponse.ok) throw new Error(channelData.error?.message || `YouTube API respondió ${channelResponse.status}.`);
      const uploadsId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
      if (!uploadsId) throw new Error("La API no encontró la lista pública de videos del canal.");
      const videosResponse = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(uploadsId)}&maxResults=13&key=${encodeURIComponent(apiKey)}`);
      const videosData = await videosResponse.json();
      if (!videosResponse.ok) throw new Error(videosData.error?.message || `YouTube API respondió ${videosResponse.status}.`);
      const videos = (videosData.items || []).map((item) => ({ id: item.contentDetails?.videoId || item.snippet?.resourceId?.videoId, title: item.snippet?.title || "Video", link: `https://www.youtube.com/watch?v=${encodeURIComponent(item.contentDetails?.videoId || item.snippet?.resourceId?.videoId || "")}` })).filter((item) => item.id);
      if (!videos.length) throw new Error("El canal no tiene videos públicos disponibles.");
      renderYouTubeVideos(target, videos);
      return;
    }
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
    let feedText = "";
    let lastError;
    for (const proxyUrl of [`https://proxy.cors.dev/${feedUrl}`, `https://api.allorigins.win/raw?url=${encodeURIComponent(feedUrl)}`]) {
      try {
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error(`El proxy respondió ${response.status}.`);
        feedText = await response.text();
        if (!feedText.includes("<feed") && !feedText.includes(":feed")) throw new Error("La respuesta no contiene un feed Atom.");
        break;
      } catch (error) { lastError = error; }
    }
    if (!feedText) throw lastError || new Error("Los proxies no están disponibles.");
    const xml = new DOMParser().parseFromString(feedText, "application/xml");
    if (xml.querySelector("parsererror")) throw new Error("YouTube devolvió un feed XML inválido.");
    const entries = [...xml.querySelectorAll("entry")].slice(0, 13).map((entry) => ({ id: entry.querySelector("videoId")?.textContent, title: entry.querySelector("title")?.textContent || "Video", link: entry.querySelector("link")?.getAttribute("href") }));
    if (!entries.length) throw new Error("El canal no tiene videos públicos todavía.");
    renderYouTubeVideos(target, entries);
  } catch (error) {
    console.warn("No se pudieron cargar videos de YouTube.", error);
    target.innerHTML = `<p class="certificate-empty">No se pudieron cargar los videos. Verifica que el ID del canal comience por UC y que tenga videos públicos. Si el ID es correcto, el proxy RSS puede estar temporalmente fuera de servicio.</p>`;
  }
}

function renderYouTubeVideos(target, videos) {
  target.innerHTML = `<article class="youtube-feature"><h2>${escapeHTML(videos[0].title)}</h2><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(videos[0].id)}" title="${escapeHTML(videos[0].title)}" loading="lazy" allowfullscreen></iframe></article><div class="youtube-grid">${videos.slice(1).map((video) => `<a class="youtube-video" href="${escapeHTML(video.link)}" target="_blank" rel="noopener noreferrer"><img src="https://i.ytimg.com/vi/${encodeURIComponent(video.id)}/hqdefault.jpg" alt="Miniatura de ${escapeHTML(video.title)}" loading="lazy"><strong>${escapeHTML(video.title)}</strong></a>`).join("")}</div>`;
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
initializeCertificates();
