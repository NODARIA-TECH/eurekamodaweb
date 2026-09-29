// Autenticación de clientes: hash de contraseña (scrypt) y sesión firmada (HMAC).
// Sin dependencias externas: sólo el módulo `crypto` de Node.
// En producción, define EUREKA_AUTH_SECRET en el entorno (VPS).
import crypto from 'crypto';

const SECRET = process.env.EUREKA_AUTH_SECRET || 'eureka-dev-secret-cambiame';
export const CUSTOMER_COOKIE = 'eureka_customer';

// Comparación en tiempo constante (evita el desajuste de tipos Buffer/Uint8Array).
function safeEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && crypto.timingSafeEqual(a as unknown as Uint8Array, b as unknown as Uint8Array);
}

/* -------- Contraseñas -------- */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored?: string): boolean {
  if (!stored) return false;
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const test = crypto.scryptSync(password, salt, 64).toString('hex');
  return safeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'));
}

/* -------- Sesión (cookie firmada) -------- */
// token = "<customerId>.<hmac>"; el middleware sólo comprueba presencia,
// la verificación real de la firma ocurre en el servidor (readSession).
export function signSession(customerId: string): string {
  const sig = crypto.createHmac('sha256', SECRET).update(customerId).digest('hex');
  return `${customerId}.${sig}`;
}

export function readSession(token?: string): string | null {
  if (!token) return null;
  const i = token.lastIndexOf('.');
  if (i < 0) return null;
  const id = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expected = crypto.createHmac('sha256', SECRET).update(id).digest('hex');
  if (!safeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  return id;
}
