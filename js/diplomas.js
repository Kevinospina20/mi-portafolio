import { config } from "./config.js";
import { getSupabaseClient } from "./content.js";

const TABLE = config.supabase.diplomasTable || "portfolio_diplomas";
const BUCKET = config.supabase.diplomasBucket || "diplomas";
const MAX_BYTES = 10 * 1024 * 1024;

export async function loadDiplomas() {
  const db = await getSupabaseClient();
  const { data, error } = await db.from(TABLE).select("id,title,public_url,file_path,created_at").order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createDiploma(title, file) {
  if (!title.trim() || !file?.name?.toLowerCase().endsWith(".pdf") || file.size > MAX_BYTES || (await file.slice(0, 5).text()) !== "%PDF-") throw new Error("Indica un título y selecciona un PDF válido de hasta 10 MB.");
  const db = await getSupabaseClient();
  const filePath = `${crypto.randomUUID()}.pdf`;
  const storage = db.storage.from(BUCKET);
  const { error: uploadError } = await storage.upload(filePath, file, { contentType: "application/pdf", upsert: false });
  if (uploadError) throw uploadError;
  const publicUrl = storage.getPublicUrl(filePath).data.publicUrl;
  const { error } = await db.from(TABLE).insert({ title: title.trim(), file_path: filePath, public_url: publicUrl });
  if (error) { await storage.remove([filePath]); throw error; }
}

export async function updateDiplomaTitle(id, title) {
  const { error } = await (await getSupabaseClient()).from(TABLE).update({ title: title.trim(), updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function deleteDiploma(row) {
  const db = await getSupabaseClient();
  const { error: storageError } = await db.storage.from(BUCKET).remove([row.file_path]);
  if (storageError) throw storageError;
  const { error } = await db.from(TABLE).delete().eq("id", row.id);
  if (error) throw error;
}

export function diplomaUrl(row) {
  if (!row?.public_url || !config.supabase.url) return "";
  try {
    const url = new URL(row.public_url);
    if (url.origin !== new URL(config.supabase.url).origin || !url.pathname.includes(`/storage/v1/object/public/${BUCKET}/`)) return "";
    return url.href;
  } catch { return ""; }
}
