export const SPMB_REQUIREMENT_VERSION = 2;

export const LEGACY_REQUIRED_DOCUMENTS = ["Kartu Keluarga", "Akta Kelahiran", "Rapor Terakhir", "Pas Foto"] as const;
export const LEGACY_OPTIONAL_DOCUMENTS = ["KIP / SKTM"] as const;
export const CURRENT_REQUIRED_DOCUMENTS = ["Kartu Keluarga", "Akta Kelahiran", "Pas Foto", "Slip/Bukti Pembayaran Uang Pendaftaran"] as const;
export const CURRENT_OPTIONAL_DOCUMENTS = ["Rapor Terakhir", "KIP / SKTM"] as const;

export function ppdbRequirements(version: number) {
  return version >= SPMB_REQUIREMENT_VERSION
    ? { required: [...CURRENT_REQUIRED_DOCUMENTS], optional: [...CURRENT_OPTIONAL_DOCUMENTS] }
    : { required: [...LEGACY_REQUIRED_DOCUMENTS], optional: [...LEGACY_OPTIONAL_DOCUMENTS] };
}

export function ppdbDocumentLabel(type: string, version: number) {
  const requirements = ppdbRequirements(version);
  return requirements.required.includes(type as never) ? "Wajib" : "Opsional";
}
