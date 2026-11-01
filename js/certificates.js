import { config } from "./config.js";
import { getSupabaseClient } from "./content.js";

const TABLE = config.supabase.certificatesTable || "portfolio_certificates";
const BUCKET = config.supabase.certificatesBucket || "certificates";
const MAX_PDF_BYTES = (Number(config.supabase.certificateMaxFileSizeMB) || 10) * 1024 * 1024;

export async function loadCertificates() {
  if (!config.supabase.url || !config.supabase.publishableKey) return [];
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("id,title,issuer,issue_date,public_url,file_path,created_at")
    .order("issue_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function subscribeToCertificates(onChange) {
  const supabase = await getSupabaseClient();
  const channel = supabase
    .channel("public-portfolio-certificates")
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: TABLE,
    }, () => {
      void loadCertificates().then(onChange).catch((error) => {
        console.warn("No se pudo actualizar la lista de certificados en vivo.", error);
      });
    })
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export function getCertificatePublicUrl(certificate) {
  if (!certificate?.public_url || !config.supabase.url) return "";
  try {
    const url = new URL(certificate.public_url);
    const projectOrigin = new URL(config.supabase.url).origin;
    if (url.protocol !== "https:" || url.origin !== projectOrigin) return "";
    if (!url.pathname.includes(`/storage/v1/object/public/${BUCKET}/`)) return "";
    return url.href;
  } catch {
    return "";
  }
}

export function makeCertificateDownloadUrl(publicUrl, title = "certificado") {
  const filename = `${String(title).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-|-$/g, "") || "certificado"}.pdf`;
  const url = new URL(publicUrl);
  url.searchParams.set("download", filename);
  return url.href;
}

async function validatePdf(file) {
  if (!file || !(file instanceof File)) throw new Error("Selecciona un archivo PDF.");
  const acceptedTypes = ["application/pdf", "application/x-pdf", "application/octet-stream"];
  if (!file.name.toLowerCase().endsWith(".pdf") || (file.type && !acceptedTypes.includes(file.type))) {
    throw new Error("El archivo debe tener formato PDF.");
  }
  if (file.size > MAX_PDF_BYTES) throw new Error(`El PDF debe pesar ${Number(config.supabase.certificateMaxFileSizeMB) || 10} MB o menos.`);
  const header = await file.slice(0, 5).text();
  if (header !== "%PDF-") throw new Error("El archivo seleccionado no parece ser un PDF válido.");
}

function validateMetadata({ title, issuer, issueDate }) {
  if (!title?.trim() || !issuer?.trim() || !issueDate) {
    throw new Error("Completa el título, la institución y la fecha.");
  }
  const parsedDate = new Date(`${issueDate}T00:00:00Z`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== issueDate) {
    throw new Error("La fecha de expedición no es válida.");
  }
}

async function uploadPdf(supabase, file) {
  await validatePdf(file);
  const filePath = `${crypto.randomUUID()}.pdf`;
  const storage = supabase.storage.from(BUCKET);
  const { error } = await storage.upload(filePath, file, {
    contentType: "application/pdf",
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const { data } = storage.getPublicUrl(filePath);
  return { filePath, publicUrl: data.publicUrl };
}

export async function createCertificate({ file, title, issuer, issueDate }) {
  validateMetadata({ title, issuer, issueDate });
  const supabase = await getSupabaseClient();
  const uploaded = await uploadPdf(supabase, file);
  const { error } = await supabase.from(TABLE).insert({
    title: title.trim(),
    issuer: issuer.trim(),
    issue_date: issueDate,
    public_url: uploaded.publicUrl,
    file_path: uploaded.filePath,
  });
  if (error) {
    await supabase.storage.from(BUCKET).remove([uploaded.filePath]);
    throw error;
  }
}

export async function updateCertificate(certificate, { title, issuer, issueDate, replacementFile }) {
  validateMetadata({ title, issuer, issueDate });
  const supabase = await getSupabaseClient();
  let uploaded = null;
  if (replacementFile?.size) uploaded = await uploadPdf(supabase, replacementFile);

  const changes = {
    title: title.trim(),
    issuer: issuer.trim(),
    issue_date: issueDate,
    updated_at: new Date().toISOString(),
  };
  if (uploaded) {
    changes.file_path = uploaded.filePath;
    changes.public_url = uploaded.publicUrl;
  }

  const { error } = await supabase.from(TABLE).update(changes).eq("id", certificate.id);
  if (error) {
    if (uploaded) await supabase.storage.from(BUCKET).remove([uploaded.filePath]);
    throw error;
  }

  if (uploaded && certificate.file_path) {
    const { error: cleanupError } = await supabase.storage.from(BUCKET).remove([certificate.file_path]);
    if (cleanupError) return { cleanupWarning: true };
  }
  return { cleanupWarning: false };
}

export async function deleteCertificate(certificate) {
  const supabase = await getSupabaseClient();
  if (certificate.file_path) {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove([certificate.file_path]);
    if (storageError) throw storageError;
  }
  const { error } = await supabase.from(TABLE).delete().eq("id", certificate.id);
  if (error) throw error;
}
