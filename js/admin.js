import { config } from "./config.js";
import { checkAdminAccess, getSupabaseClient, loadContent, savePortfolioContent } from "./content.js";

const loginView = document.getElementById("login-view");
const adminApp = document.getElementById("admin-app");
const loginForm = document.getElementById("login-form");
const loginStatus = document.getElementById("login-status");
const contentForm = document.getElementById("content-form");
const saveState = document.getElementById("save-state");
let supabase;
let currentContent;
let toastTimer;

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
  renderSocialEditor(content.socials || config.socials);
  renderList(document.getElementById("experience-editor"), "experience-template", profile.experience);
  renderList(document.getElementById("education-editor"), "education-template", profile.education);
  renderList(document.getElementById("skills-editor"), "skills-template", profile.skills);
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
  document.querySelectorAll("[data-setting]").forEach((input) => { settings[input.dataset.setting] = input.value.trim() || "TU_USUARIO_GITHUB"; });
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
  return true;
}

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
  else showLogin("Sesión cerrada correctamente.", "success");
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
