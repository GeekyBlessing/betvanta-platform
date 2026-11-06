import { randomBytes, scrypt as _scrypt, timingSafeEqual, createHash, createHmac } from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(_scrypt) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;

const N = 16384, r = 8, p = 1, LEN = 64;
export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, LEN, { N, r, p, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${key.toString("base64")}`;
}
export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, rr, pp, s, k] = parts;
  const expected = Buffer.from(k, "base64");
  const got = await scrypt(pw, Buffer.from(s, "base64"), expected.length, { N: +n, r: +rr, p: +pp, maxmem: 64 * 1024 * 1024 });
  return got.length === expected.length && timingSafeEqual(got, expected);
}
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export function hmacSha512Hex(secret: string, body: string) { return createHmac("sha512", secret).update(body).digest("hex"); }
export function safeEqualHex(a: string, b: string) {
  const x = Buffer.from(a, "hex"), y = Buffer.from(b, "hex");
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
}
/** Dummy hash so login timing does not reveal whether an email exists. */
export const DUMMY_HASH = "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" + Buffer.alloc(64).toString("base64");
