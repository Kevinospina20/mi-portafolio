import { config } from "./config.js";
import { checkAdminAccess, getSupabaseClient, loadContent, savePortfolioContent } from "./content.js";
import { createCertificate, deleteCertificate, getCertificatePublicUrl, loadCertificates, subscribeToCertificates, updateCertificate } from "./certificates.js";
import { createDiploma, deleteDiploma, loadDiplomas, updateDiplomaTitle } from "./diplomas.js";

const loginView = document.getElementById("login-view");
const adminApp = document.getElementById("admin-app");
const loginForm = document.getElementById("login-form");
const loginStatus = document.getElementById("login-status");
const contentForm = document.getElementById("content-form");
const saveState = document.getElementById("save-state");
let supabase;
let currentContent;
let toastTimer;
let certificateRows = [];
let stopCertificateSubscription;
let diplomaRows = [];

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function showLogin(message, kind = "") {
  loginView.hidden = false;
  adminApp.hidden = true;
  loginStatus.textContent = message;
  loginStatus.className = `login-status ${kind}`.trim();
}

function showToast(message) {
  const toast = document.getElementById("admin-toast");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 3000);
}

function renderList(container, templateId, values) {
  const template = document.getElementById(templateId);
  container.replaceChildren();
  (Array.isArray(values) ? values : []).forEach((item) => {
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector(".repeat-card");
    card.querySelectorAll("[data-entry-field]").forEach((input) => {
      const key = input.dataset.entryField;
      if (item[key] !== undefined && item[key] !== null) input.value = String(item[key]);
    });
    container.append(fragment);
  });
}

function renderSocialEditor(socials) {
  const container = document.getElementById("social-editor");
  const source = Array.isArray(socials) ? socials : [];
  const networks = ["Instagram", "Discord", "LinkedIn", "GitHub"];
  const list = [...networks.map((name) => source.find((item) => item.name === name) || { name, url: "", handle: "" }), ...source.filter((item) => !networks.includes(item.name))];
  container.replaceChildren();
  list.forEach((social) => {
    const wrapper = document.createElement("div");
    wrapper.className = "social-editor";
    const tone = social.name === "Instagram" ? "coral" : social.name === "Discord" ? "violet" : social.name === "LinkedIn" ? "blue" : "lime";
    wrapper.innerHTML = `<span class="social-editor-icon" style="--social-color:var(--${tone})">${escapeHTML(social.name.slice(0, 1))}</span><div class="social-editor-fields"><label>${escapeHTML(social.name)} · URL<input data-social-name="${escapeHTML(social.name)}" data-social-field="url" type="url" placeholder="https://${escapeHTML(social.name.toLowerCase())}.com/tu-perfil" value="${escapeHTML(social.url === "#" ? "" : social.url)}"></label><label>Texto corto<input data-social-name="${escapeHTML(social.name)}" data-social-field="handle" value="${escapeHTML(social.handle || "")}" placeholder="Nombre de usuario o invitación"></label></div>`;
    container.append(wrapper);
  });
}

function fillProfile(content) {
  const profile = content.profile || {};
  document.querySelectorAll("[data-profile]").forEach((input) => {
    const value = profile[input.dataset.profile];
    input.value = value ?? "";
  });
  document.querySelectorAll("[data-stat]").forEach((input) => { input.value = profile.stats?.[input.dataset.stat] ?? ""; });
  document.querySelectorAll("[data-setting='githubUsername']").forEach((input) => { input.value = content.githubUsername === "TU_USUARIO_GITHUB" ? "" : (content.githubUsername || ""); });
  document.querySelectorAll("[data-setting='youtubeChannelId']").forEach((input) => { input.value = content.youtubeChannelId || ""; });
  renderSocialEditor(content.socials || config.socials);
  renderList(document.getElementById("experience-editor"), "experience-template", profile.experience);
  renderList(document.getElementById("education-editor"), "education-template", profile.education);
  renderList(document.getElementById("skills-editor"), "skills-template", profile.skills);
}

function renderCertificateEditor(rows) {
  const list = document.getElementById("certificate-admin-list");
  const count = document.getElementById("certificate-admin-count");
  certificateRows = Array.isArray(rows) ? rows : [];
  count.textContent = String(certificateRows.length).padStart(2, "0");
  if (!certificateRows.length) {
    list.innerHTML = '<p class="certificate-admin-empty">Todavía no has agregado certificados.</p>';
    return;
  }

  list.innerHTML = certificateRows.map((certificate) => {
    const url = getCertificatePublicUrl(certificate);
    return `<article class="certificate-admin-row" data-certificate-id="${escapeHTML(certificate.id)}">
      <div class="certificate-admin-row-top"><span class="certificate-admin-file-icon">PDF</span><div><p class="certificate-admin-row-title">${escapeHTML(certificate.title)}</p><a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">Abrir PDF ↗</a></div><button class="remove-button certificate-delete-button" type="button" data-certificate-action="delete">Eliminar</button></div>
      <div class="field-grid certificate-admin-fields">
        <label>Título<input data-certificate-field="title" required maxlength="160" value="${escapeHTML(certificate.title)}" /></label>
        <label>Institución o emisor<input data-certificate-field="issuer" required maxlength="160" value="${escapeHTML(certificate.issuer)}" /></label>
        <label>Fecha de expedición<input data-certificate-field="issueDate" type="date" required value="${escapeHTML(certificate.issue_date)}" /></label>
        <label>Reemplazar archivo PDF (opcional)<input data-certificate-field="replacementFile" type="file" accept="application/pdf,.pdf" /></label>
      </div>
      <div class="certificate-admin-row-footer"><span class="certificate-row-status" role="status"></span><button class="certificate-save-button" type="button" data-certificate-action="save">Guardar certificado</button></div>
    </article>`;
  }).join("");
}

async function refreshAdminCertificates(rows) {
  const status = document.getElementById("certificate-upload-status");
  if (Array.isArray(rows)) {
    renderCertificateEditor(rows);
    return;
  }
  try {
    renderCertificateEditor(await loadCertificates());
  } catch (error) {
    document.getElementById("certificate-admin-count").textContent = "—";
    document.getElementById("certificate-admin-list").innerHTML = '<p class="certificate-admin-empty">No se pudo cargar la tabla de certificados. Sigue los pasos de Storage en el README y vuelve a cargar el panel.</p>';
    if (status) status.textContent = error.message || "Revisa la tabla y las políticas de Supabase.";
  }
}

async function startCertificateSubscription() {
  if (stopCertificateSubscription) return;
  try {
    stopCertificateSubscription = await subscribeToCertificates((rows) => { void refreshAdminCertificates(rows); });
  } catch (error) {
    console.info("Actualización en vivo de certificados no disponible en el panel.", error);
  }
}

function collectRows(container) {
  return [...container.querySelectorAll(".repeat-card")].map((card) => {
    const entry = {};
    card.querySelectorAll("[data-entry-field]").forEach((input) => {
      const value = input.value.trim();
      entry[input.dataset.entryField] = input.type === "number" ? Math.min(100, Math.max(0, Number(value) || 0)) : value;
    });
    return entry;
  }).filter((entry) => Object.values(entry).some((value) => String(value).trim() !== ""));
}

function collectContent() {
  const profile = { ...(currentContent.profile || {}) };
  document.querySelectorAll("[data-profile]").forEach((input) => { profile[input.dataset.profile] = input.value.trim(); });
  profile.stats = { ...(profile.stats || {}) };
  document.querySelectorAll("[data-stat]").forEach((input) => { profile.stats[input.dataset.stat] = input.value.trim() || "—"; });
  profile.experience = collectRows(document.getElementById("experience-editor"));
  profile.education = collectRows(document.getElementById("education-editor"));
  profile.skills = collectRows(document.getElementById("skills-editor"));
  const socialMap = new Map((currentContent.socials || config.socials).map((item) => [item.name, { ...item }]));
  document.querySelectorAll("[data-social-name]").forEach((input) => {
    const name = input.dataset.socialName;
    const field = input.dataset.socialField;
    const item = socialMap.get(name) || { name, icon: name.toLowerCase(), color: "lime" };
    item[field] = input.value.trim();
    socialMap.set(name, item);
  });
  const socials = [...socialMap.values()].map((item) => ({ ...item, url: item.url || "#" }));
  const settings = {};
  document.querySelectorAll("[data-setting]").forEach((input) => { settings[input.dataset.setting] = input.value.trim() || (input.dataset.setting === "githubUsername" ? "TU_USUARIO_GITHUB" : ""); });
  return { ...currentContent, ...settings, profile, socials };
}

async function authorizeAndOpen(user) {
  const allowed = await checkAdminAccess(supabase);
  if (!allowed) {
    await supabase.auth.signOut({ scope: "local" });
    showLogin("La cuenta inició sesión, pero no está autorizada como administradora. Añádela a portfolio_admins en Supabase.", "error");
    return false;
  }
  currentContent = await loadContent();
  fillProfile(currentContent);
  document.getElementById("admin-email").textContent = user.email || "Sesión de administrador";
  loginView.hidden = true;
  adminApp.hidden = false;
  void refreshAdminCertificates();
  void refreshDiplomas();
  void startCertificateSubscription();
  return true;
}

async function refreshDiplomas() {
  const list = document.getElementById("diploma-admin-list");
  try {
    diplomaRows = await loadDiplomas();
    list.innerHTML = diplomaRows.map((row) => `<article class="certificate-admin-row" data-diploma-id="${escapeHTML(row.id)}"><div class="certificate-admin-row-top"><a href="${escapeHTML(row.public_url)}" target="_blank" rel="noopener">Abrir PDF ↗</a><button class="remove-button" type="button" data-diploma-action="delete">Eliminar</button></div><label>Título<input data-diploma-title maxlength="160" value="${escapeHTML(row.title)}"></label><button type="button" data-diploma-action="save">Guardar título</button></article>`).join("") || '<p class="certificate-admin-empty">Todavía no hay diplomas.</p>';
  } catch (error) { list.textContent = `No se pudo cargar diplomas. Configura portfolio_diplomas y el bucket diplomas en Supabase. ${error.message || ""}`; }
}

document.getElementById("diploma-upload-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = new FormData(form);
  const status = document.getElementById("diploma-upload-status");
  try { await createDiploma(String(values.get("title") || ""), values.get("file")); form.reset(); status.textContent = "Diploma agregado."; await refreshDiplomas(); }
  catch (error) { status.textContent = error.message || "No se pudo guardar el diploma."; }
});

document.getElementById("diploma-admin-list").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-diploma-action]");
  if (!button) return;
  const card = button.closest("[data-diploma-id]");
  const row = diplomaRows.find((item) => item.id === card?.dataset.diplomaId);
  if (!row) return;
  try {
    if (button.dataset.diplomaAction === "delete") { if (!window.confirm(`¿Eliminar «${row.title}» y su PDF?`)) return; await deleteDiploma(row); }
    else await updateDiplomaTitle(row.id, card.querySelector("[data-diploma-title]").value);
    await refreshDiplomas();
  } catch (error) { window.alert(error.message || "No se pudo actualizar el diploma."); }
});

document.querySelectorAll("[data-add]").forEach((button) => button.addEventListener("click", () => {
  const key = button.dataset.add;
  const container = document.getElementById(`${key}-editor`);
  container.append(document.getElementById(`${key}-template`).content.cloneNode(true));
  container.lastElementChild?.querySelector("input")?.focus();
}));

document.addEventListener("click", (event) => {
  const remove = event.target.closest(".remove-button");
  if (remove) remove.closest(".repeat-card")?.remove();
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = loginForm.querySelector("button[type=submit]");
  submit.disabled = true;
  showLogin("Verificando acceso…");
  const values = new FormData(loginForm);
  try {
    if (!supabase) supabase = await getSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email: values.get("email"), password: values.get("password") });
    if (error) throw error;
    try { await authorizeAndOpen(data.user); }
    catch (accessError) {
      await supabase.auth.signOut({ scope: "local" });
      showLogin("No se pudo verificar el permiso. Ejecuta el SQL de seguridad del README y añade tu UUID a portfolio_admins.", "error");
      console.warn(accessError);
    }
  } catch (error) {
    showLogin(error.message?.includes("Configura Supabase") ? error.message : "No se pudo iniciar sesión. Revisa el correo, la contraseña y la configuración de Supabase.", "error");
  } finally {
    submit.disabled = false;
  }
});

document.getElementById("logout-button").addEventListener("click", async () => {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) showToast("No fue posible cerrar la sesión. Inténtalo de nuevo.");
  else {
    if (stopCertificateSubscription) stopCertificateSubscription();
    stopCertificateSubscription = null;
    showLogin("Sesión cerrada correctamente.", "success");
  }
});

contentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = contentForm.querySelector(".save-button");
  button.disabled = true;
  saveState.textContent = "Guardando…";
  try {
    const nextContent = collectContent();
    const invalidSocial = nextContent.socials.find((social) => social.url !== "#" && social.url && !/^https:\/\//i.test(social.url));
    if (invalidSocial) throw new Error(`El enlace de ${invalidSocial.name} debe comenzar con https://`);
    await savePortfolioContent(nextContent);
    currentContent = nextContent;
    saveState.textContent = `Guardado a las ${new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit" }).format(new Date())}`;
    document.getElementById("save-message").textContent = "Cambios guardados. La página pública se actualizará en unos segundos.";
    showToast("Perfil actualizado correctamente.");
  } catch (error) {
    saveState.textContent = "No se pudo guardar";
    document.getElementById("save-message").textContent = error.message || "Revisa las políticas RLS y la conexión a Supabase.";
    showToast("No se guardaron los cambios. Revisa la configuración de Supabase.");
  } finally {
    button.disabled = false;
  }
});

const certificateUploadForm = document.getElementById("certificate-upload-form");
certificateUploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = document.getElementById("certificate-upload-button");
  const status = document.getElementById("certificate-upload-status");
  const values = new FormData(certificateUploadForm);
  button.disabled = true;
  status.textContent = "Subiendo el PDF y guardando los datos…";
  try {
    await createCertificate({
      title: String(values.get("title") || ""),
      issuer: String(values.get("issuer") || ""),
      issueDate: String(values.get("issueDate") || ""),
      file: values.get("file"),
    });
    certificateUploadForm.reset();
    status.textContent = "Certificado agregado. Ya está disponible en la página pública.";
    showToast("Certificado publicado correctamente.");
    await refreshAdminCertificates();
  } catch (error) {
    status.textContent = error.message || "No se pudo subir. Revisa el bucket y sus políticas de Supabase.";
    showToast("No se pudo guardar el certificado.");
  } finally {
    button.disabled = false;
  }
});

document.getElementById("certificate-admin-list").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-certificate-action]");
  if (!button) return;
  const card = button.closest("[data-certificate-id]");
  const certificate = certificateRows.find((row) => row.id === card?.dataset.certificateId);
  if (!certificate) return;
  const rowStatus = card.querySelector(".certificate-row-status");
  button.disabled = true;

  try {
    if (button.dataset.certificateAction === "save") {
      const title = card.querySelector('[data-certificate-field="title"]').value.trim();
      const issuer = card.querySelector('[data-certificate-field="issuer"]').value.trim();
      const issueDate = card.querySelector('[data-certificate-field="issueDate"]').value;
      const replacementFile = card.querySelector('[data-certificate-field="replacementFile"]').files[0] || null;
      if (!title || !issuer || !issueDate) throw new Error("Completa el título, la institución y la fecha.");
      rowStatus.textContent = "Guardando…";
      const result = await updateCertificate(certificate, { title, issuer, issueDate, replacementFile });
      rowStatus.textContent = result.cleanupWarning ? "Actualizado. No se pudo retirar el PDF anterior del bucket." : "Cambios guardados.";
      showToast(result.cleanupWarning ? "Actualizado; revisa el PDF anterior en Storage." : "Certificado actualizado.");
      await refreshAdminCertificates();
    } else if (button.dataset.certificateAction === "delete") {
      const confirmed = window.confirm(`¿Eliminar “${certificate.title}” y su PDF? Esta acción no se puede deshacer.`);
      if (!confirmed) return;
      rowStatus.textContent = "Eliminando…";
      await deleteCertificate(certificate);
      showToast("Certificado eliminado.");
      await refreshAdminCertificates();
    }
  } catch (error) {
    rowStatus.textContent = error.message || "No se pudo guardar el certificado.";
  } finally {
    button.disabled = false;
  }
});

async function boot() {
  try {
    supabase = await getSupabaseClient();
    loginStatus.textContent = "Usa el usuario administrador que configuraste en Supabase.";
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (data.session?.user) {
      try { await authorizeAndOpen(data.session.user); }
      catch (accessError) { showLogin("No se pudo verificar el rol de administrador. Ejecuta el SQL de seguridad indicado en el README.", "error"); console.warn(accessError); }
    }
  } catch (error) {
    loginStatus.textContent = error.message || "Configura Supabase URL y publishableKey en js/config.js para activar el panel.";
    loginStatus.classList.add("error");
  }
}

boot();
