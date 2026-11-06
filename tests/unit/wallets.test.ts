import { describe, expect, it } from "vitest";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { explorerUrl, WALLETS } from "@/lib/services/manual-payments/methods";
import { newReference, sniffProof } from "@/lib/services/manual-payments";

// EIP-55: the mixed-case 0x address encodes its own checksum. A single mistyped character fails this test.
function eip55(addr: string) {
  const hex = addr.slice(2).toLowerCase();
  const hash = Buffer.from(keccak_256(new TextEncoder().encode(hex))).toString("hex");
  return "0x" + [...hex].map((c, i) => (parseInt(hash[i], 16) >= 8 ? c.toUpperCase() : c)).join("");
}
// BIP-173 bech32 checksum for bc1 addresses.
function bech32Valid(s: string) {
  const CH = "qpzry9x8gf2tvdw0s3jn54khce6mua7l", G = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  const pos = s.lastIndexOf("1"), hrp = s.slice(0, pos), data = [...s.slice(pos + 1)].map((c) => CH.indexOf(c));
  if (data.includes(-1)) return false;
  const v = [...[...hrp].map((c) => c.charCodeAt(0) >> 5), 0, ...[...hrp].map((c) => c.charCodeAt(0) & 31), ...data];
  let chk = 1;
  for (const x of v) { const b = chk >>> 25; chk = ((chk & 0x1ffffff) << 5) ^ x; for (let i = 0; i < 5; i++) if ((b >>> i) & 1) chk ^= G[i]; }
  return chk >>> 0 === 1;
}

describe("client-confirmed wallets", () => {
  it("keeps the exact addresses the client provided", () => {
    expect(WALLETS.eth.address).toBe("0x283bed6B2dB8b70FB245a9734fc6479C60C59E9C");
    expect(WALLETS.btc.address).toBe("bc1qu2pq8h060lpu3g5yg8zzc39lr85mal3vpek4dv");
    expect(WALLETS.usdt.address).toBe("0x7EE5E8D5149A55c6049f7b1042834cDAEB2f246d");
  });
  it("ETH and USDT addresses pass the EIP-55 checksum", () => {
    expect(eip55(WALLETS.eth.address)).toBe(WALLETS.eth.address);
    expect(eip55(WALLETS.usdt.address)).toBe(WALLETS.usdt.address);
    expect(eip55("0x283bed6B2dB8b70FB245a9734fc6479C60C59E9D")).not.toBe("0x283bed6B2dB8b70FB245a9734fc6479C60C59E9D");
  });
  it("the BTC address is a valid Bitcoin mainnet bech32 address", () => {
    expect(WALLETS.btc.address.startsWith("bc1q")).toBe(true);
    expect(bech32Valid(WALLETS.btc.address)).toBe(true);
    expect(bech32Valid("bc1qu2pq8h060lpu3g5yg8zzc39lr85mal3vpek4dw")).toBe(false);
  });
});

describe("payment proof and references", () => {
  it("detects file types from content, not names", () => {
    expect(sniffProof(Buffer.from("89504e470d0a1a0a00", "hex"))).toBe("image/png");
    expect(sniffProof(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffProof(Buffer.from("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(sniffProof(Buffer.from("%PDF-1.7"))).toBe("application/pdf");
    expect(sniffProof(Buffer.from("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffProof(Buffer.from("<html>"))).toBeNull();
  });
  it("creates readable unique references", () => {
    const refs = new Set(Array.from({ length: 500 }, newReference));
    expect(refs.size).toBe(500);
    for (const r of refs) expect(r).toMatch(/^BV-M-[0-9ABCDEFGHJKMNPQRSTVWXYZ]{8}$/);
  });
  it("links to a block explorer only when the network and hash are known", () => {
    expect(explorerUrl("btc", "Bitcoin", "a".repeat(64))).toBe(`https://mempool.space/tx/${"a".repeat(64)}`);
    expect(explorerUrl("usdt", null, "0x" + "a".repeat(64))).toBeNull();
    expect(explorerUrl("usdt", "Ethereum (ERC-20)", "0x" + "a".repeat(64))).toBe(`https://etherscan.io/tx/0x${"a".repeat(64)}`);
    expect(explorerUrl("eth", "Ethereum", "not-a-hash")).toBeNull();
    expect(explorerUrl("paypal", null, "PP-1")).toBeNull();
  });
});
