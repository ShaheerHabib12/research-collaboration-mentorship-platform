/**
 * auth.js - password hashing (NFR-002) and JSON Web Tokens (C2, NFR-001).
 *
 * Passwords: bcrypt (adaptive, per-account random salt; the salt and cost are stored inside the hash).
 * Raw passwords are never logged. Unknown accounts still cost one bcrypt comparison so response
 * time does not reveal whether an email exists.
 *
 * Tokens: HS256 JWT (RFC 7519, Jones et al., 2015) issued and checked with `jsonwebtoken`.
 * Claims: sub (user id), iat, exp (8 h), optional pv (password fingerprint) and purpose.
 */
'use strict';
const crypto = require('node:crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const ROUNDS = Number(process.env.RCMP_BCRYPT_ROUNDS || 12);
const TOKEN_TTL_SECONDS = 8 * 60 * 60;
let dummy = null;

/** bcrypt hash of a password (NFR-002). */
function hashPassword(pw) { return bcrypt.hash(String(pw), ROUNDS); }

/** Always performs one bcrypt comparison, even for unknown accounts, to avoid a timing oracle. */
async function verifyPassword(pw, stored) {
  if (!stored) { dummy = dummy || (await bcrypt.hash('not-a-real-password', ROUNDS)); await bcrypt.compare(String(pw), dummy); return false; }
  try { return await bcrypt.compare(String(pw), String(stored)); } catch (e) { return false; }
}

/** Create an HS256 JWT for a user with an expiry; `extra` adds claims such as `pv` (password fingerprint) or `purpose`. */
function signToken(userId, secret, nowMs, extra, ttl) {
  const iat = Math.floor((nowMs || Date.now()) / 1000);
  return jwt.sign(Object.assign({ sub: userId, iat, exp: iat + (ttl || TOKEN_TTL_SECONDS) }, extra), secret, { algorithm: 'HS256' });
}
/** @returns {{sub:string, exp:number}|null} claims, or null if missing, forged, wrong algorithm or expired */
function verifyToken(token, secret, nowMs) {
  if (!token) return null;
  try {
    const claims = jwt.verify(String(token), secret, { algorithms: ['HS256'], clockTimestamp: nowMs ? Math.floor(nowMs / 1000) : undefined });
    return claims && claims.sub ? claims : null;
  } catch (e) { return null; }
}

/**
 * Short fingerprint of the stored password hash. It is embedded in session and
 * reset tokens ("pv" claim), so changing the password invalidates every older
 * token: a reset link works once, and a reset signs out stolen sessions.
 */
function pwFingerprint(stored) { return crypto.createHash('sha256').update(String(stored || '')).digest('hex').slice(0, 12); }
const RESET_TTL_SECONDS = 30 * 60;

/* ---- Email verification PIN ------------------------------------------- */
const PIN_TTL_MS = 10 * 60 * 1000, PIN_MAX_TRIES = 5, PIN_RESEND_MS = 60 * 1000, PIN_MAX_SENDS_PER_HOUR = 5;
/** A uniformly random 6-digit PIN from the operating system's CSPRNG (never Math.random). */
function newPin() { return String(crypto.randomInt(0, 1000000)).padStart(6, '0'); }
/** Only a keyed hash of the PIN is stored, so a database leak does not reveal live PINs. */
function pinHash(secret, userId, pin) { return crypto.createHmac('sha256', secret).update(userId + ':' + pin).digest('hex'); }
function pinMatches(secret, userId, pin, stored) {
  const a = Buffer.from(pinHash(secret, userId, String(pin)), 'hex'), b = Buffer.from(String(stored || ''), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { newPin, pinHash, pinMatches, PIN_TTL_MS, PIN_MAX_TRIES, PIN_RESEND_MS, PIN_MAX_SENDS_PER_HOUR, hashPassword, verifyPassword, signToken, verifyToken, pwFingerprint, TOKEN_TTL_SECONDS, RESET_TTL_SECONDS };
