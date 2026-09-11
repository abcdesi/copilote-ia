import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * Chiffrement au repos (AES-256-GCM) pour les champs réellement sensibles —
 * tokens OAuth, clés API tierces, identifiants de connexion à un outil client.
 *
 * Rien dans le produit n'utilise encore cette fonction : tant qu'aucune vraie
 * intégration (Gmail, Slack...) n'est connectée, il n'existe aucune donnée de
 * ce type à protéger. Elle est prête pour le jour où de vrais tokens seront
 * stockés — brancher `encrypt()` avant l'écriture en base et `decrypt()` à la
 * lecture, sur ce champ précis uniquement.
 *
 * Nécessite ENCRYPTION_KEY dans l'environnement : 32 octets en base64
 * (générer avec `openssl rand -base64 32`).
 */

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY manquante — requise pour chiffrer/déchiffrer des données sensibles.");
  }
  const buf = Buffer.from(key, "base64");
  if (buf.length !== 32) {
    throw new Error("ENCRYPTION_KEY doit faire 32 octets une fois décodée en base64.");
  }
  return buf;
}

// Format stocké : iv.authTag.ciphertext, chaque segment en base64.
export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(".");
}

export function decrypt(stored: string): string {
  const [ivB64, authTagB64, ciphertextB64] = stored.split(".");
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Format de donnée chiffrée invalide.");
  }
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextB64, "base64")), decipher.final()]);
  return plaintext.toString("utf8");
}
