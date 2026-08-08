export function ownerEmail() {
  return String(process.env.SINURMAN_OWNER_EMAIL ?? "").trim().toLowerCase();
}

export function isOwnerEmail(email: string) {
  const configured = ownerEmail();
  return Boolean(configured && email.trim().toLowerCase() === configured);
}
