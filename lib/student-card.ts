export function studentNumber(entryYear: string, educationLevel: string) {
  const year = entryYear.replace(/[^0-9]/g, "").slice(0, 4) || String(new Date().getUTCFullYear());
  const unit = educationLevel.trim().toUpperCase().replace(/[^A-Z0-9]/g, "") || "SANTRI";
  return `NI-${year}-${unit}-${crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

export function publicCardToken() {
  return `SC-${crypto.randomUUID().replaceAll("-", "").toUpperCase()}`;
}

export function cardStatus(status: unknown) {
  const value = String(status || "Aktif");
  if (["Alumni", "Lulus"].includes(value)) return "Lulus";
  if (["Nonaktif", "Tidak Aktif"].includes(value)) return "Tidak Aktif";
  return "Aktif";
}
