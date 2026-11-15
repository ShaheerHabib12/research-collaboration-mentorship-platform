/**
 * storage.js - C9 encrypted file store (NFR-001, FR-029).
 *
 * Files are encrypted with AES-256-GCM before they touch the disk. Each file
 * gets its own random 12-byte IV and authentication tag, and is stored as
 *   [iv(12)] [tag(16)] [ciphertext]
 * under an opaque id, never under the user's file name (path traversal
 * is impossible). The key comes from RCMP_FILE_KEY (32 bytes, hex) - in
 * production it belongs in a secrets manager, never in the repository.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

/** AES-256-GCM encrypted file store: put, get, remove. Ids are validated so a path cannot escape the folder (NFR-001). */
function createStorage(dir, keyHex) {
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) throw new Error('RCMP_FILE_KEY must be 32 bytes (64 hex characters).');
  if (dir) fs.mkdirSync(dir, { recursive: true });
  const safe = (id) => { if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error('Invalid storage id'); return path.join(dir, id + '.bin'); };
  return {
    put(id, bytes) {
      const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', key, iv);
      const enc = Buffer.concat([c.update(bytes), c.final()]);
      fs.writeFileSync(safe(id), Buffer.concat([iv, c.getAuthTag(), enc]));
    },
    get(id) {
      let raw; try { raw = fs.readFileSync(safe(id)); } catch (e) { return null; }
      const d = crypto.createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
      d.setAuthTag(raw.subarray(12, 28));
      return Buffer.concat([d.update(raw.subarray(28)), d.final()]);
    },
    clear() { fs.readdirSync(dir).forEach((f) => fs.unlinkSync(path.join(dir, f))); },
    has(id) { return fs.existsSync(safe(id)); },
    remove(id) { try { fs.unlinkSync(safe(id)); } catch (e) { /* already gone */ } }
  };
}
module.exports = { createStorage };
