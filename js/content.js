// Adaptador de contenido: Supabase opcional con fallback local y sin bloqueo de la web.
import { config } from "./config.js";

let clientPromise;

export async function getSupabaseClient() {
  const { url, publishableKey } = config.supabase;
  if (!url || !publishableKey) throw new Error("Configura Supabase URL y publishableKey en js/config.js.");
  clientPromise ||= import("https://esm.sh/@supabase/supabase-js@2").then(({ createClient }) => createClient(url, publishableKey));
  return clientPromise;
}

export async function loadContent() {
  if (!config.supabase.url || !config.supabase.publishableKey) return config;
  try {
    const supabase = await getSupabaseClient();
    const { contentTable, contentId } = config.supabase;
    const { data, error } = await supabase.from(contentTable).select("content").eq("id", contentId).maybeSingle();
    if (error) throw error;
    return data?.content ? mergeContent(config, data.content) : config;
  } catch (error) {
    console.warn("No fue posible cargar contenido de Supabase; usando los datos locales.", error);
    return config;
  }
}

export async function subscribeToContent(onContent) {
  const supabase = await getSupabaseClient();
  const { contentTable, contentId } = config.supabase;
  const channel = supabase
    .channel("public-portfolio-content")
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: contentTable,
      filter: `id=eq.${contentId}`,
    }, (payload) => {
      if (payload.new?.content) onContent(mergeContent(config, payload.new.content));
    })
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export async function checkAdminAccess(supabase) {
  const { data, error } = await supabase.rpc("is_portfolio_admin");
  if (error) throw error;
  return data === true;
}

export async function savePortfolioContent(content) {
  const supabase = await getSupabaseClient();
  const { contentTable, contentId } = config.supabase;
  const { error } = await supabase
    .from(contentTable)
    .upsert({ id: contentId, content, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) throw error;
}

function mergeContent(base, remote) {
  return {
    ...base,
    ...remote,
    profile: { ...base.profile, ...remote.profile },
    socials: Array.isArray(remote.socials) ? remote.socials : base.socials,
    supabase: base.supabase,
  };
}
