import { env } from "../../env";
import { isEthereumMainnet, WALLETS, type CryptoMethod } from "./methods";

/**
 * Checks a member's crypto payment on the blockchain itself, so a plan is never activated from a screenshot.
 *  - BTC: the public mempool.space API. The transaction must pay BETVANTA's bc1 address and have enough confirmations.
 *  - ETH and USDT on Ethereum mainnet: Etherscan (ETHERSCAN_API_KEY). ETH must be sent to BETVANTA's address;
 *    USDT must be a successful Tether transfer to BETVANTA's address for at least the plan price.
 * Anything else (another network, no API key, no transaction hash) is "unsupported": an admin must verify it by hand.
 */
export type ChainResult = {
  status: "verified" | "failed" | "pending" | "unsupported" | "error";
  summary: string;
  details?: Record<string, unknown>;
};

const USDT_ERC20 = "0xdac17f958d2ee523a2206206994597c13d831ec7";
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const TIMEOUT = 10_000;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT), headers: { accept: "application/json" } });
  if (res.status === 404) throw Object.assign(new Error("not found"), { notFound: true });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

type MempoolTx = { txid: string; vout: { scriptpubkey_address?: string; value: number }[]; status: { confirmed: boolean; block_height?: number } };

export async function checkBtc(txid: string, address = WALLETS.btc.address): Promise<ChainResult> {
  const base = env().MEMPOOL_API_BASE.replace(/\/$/, "");
  let tx: MempoolTx;
  try { tx = await getJson<MempoolTx>(`${base}/api/tx/${txid}`); }
  catch (e) {
    if ((e as { notFound?: boolean }).notFound) return { status: "failed", summary: "This transaction does not exist on the Bitcoin network." };
    return { status: "error", summary: `Could not reach the Bitcoin explorer (${(e as Error).message}). Try again.` };
  }
  const sats = tx.vout.filter((o) => o.scriptpubkey_address === address).reduce((a, o) => a + o.value, 0);
  if (sats === 0) return { status: "failed", summary: "This transaction does not pay the BETVANTA Bitcoin address.", details: { txid } };
  let confirmations = 0;
  if (tx.status.confirmed && tx.status.block_height) {
    try { const tip = await (await fetch(`${base}/api/blocks/tip/height`, { signal: AbortSignal.timeout(TIMEOUT) })).text(); confirmations = Number(tip) - tx.status.block_height + 1; }
    catch { return { status: "error", summary: "Could not read the current block height. Try again." }; }
  }
  const btc = sats / 1e8;
  const need = env().BTC_MIN_CONFIRMATIONS;
  const details = { txid, amountSats: sats, amountBtc: btc, confirmations, required: need };
  if (confirmations < need) return { status: "pending", summary: `${btc} BTC received, ${confirmations} of ${need} confirmations. Check again later.`, details };
  return { status: "verified", summary: `${btc} BTC received at the BETVANTA address with ${confirmations} confirmations. Confirm the amount covers the plan price.`, details };
}

type RpcResult<T> = { result: T | null; error?: { message: string }; status?: string; message?: string };
type EvmTx = { to: string | null; value: string; blockNumber: string | null; hash: string };
type EvmReceipt = { status: string; blockNumber: string; logs: { address: string; topics: string[]; data: string }[] };

async function etherscan<T>(action: string, extra: Record<string, string>): Promise<T | null> {
  const key = env().ETHERSCAN_API_KEY!;
  const u = new URL(env().ETHERSCAN_API_BASE);
  for (const [k, v] of Object.entries({ chainid: "1", module: "proxy", action, apikey: key, ...extra })) u.searchParams.set(k, v);
  const r = await getJson<RpcResult<T>>(u.toString());
  if (r.error) throw new Error(r.error.message);
  if (r.status === "0") throw new Error(r.message ?? "Etherscan error");
  return r.result;
}

export async function checkEvm(method: "eth" | "usdt", hash: string, network: string | null, minUsd: number): Promise<ChainResult> {
  if (!isEthereumMainnet(network)) return { status: "unsupported", summary: `Automatic checks cover Ethereum mainnet only; this payment is on ${network ?? "an unconfirmed network"}. Verify it in that network's explorer.` };
  if (!env().ETHERSCAN_API_KEY) return { status: "unsupported", summary: "Automatic Ethereum checks need ETHERSCAN_API_KEY. Verify it on etherscan.io." };
  const address = WALLETS[method].address.toLowerCase();
  let tx: EvmTx | null, receipt: EvmReceipt | null, head: string | null;
  try {
    [tx, receipt, head] = await Promise.all([
      etherscan<EvmTx>("eth_getTransactionByHash", { txhash: hash }),
      etherscan<EvmReceipt>("eth_getTransactionReceipt", { txhash: hash }),
      etherscan<string>("eth_blockNumber", {}),
    ]);
  } catch (e) { return { status: "error", summary: `Could not reach Etherscan (${(e as Error).message}). Try again.` }; }
  if (!tx) return { status: "failed", summary: "This transaction does not exist on Ethereum mainnet." };
  if (!receipt || !tx.blockNumber) return { status: "pending", summary: "The transaction is not in a block yet. Check again later." };
  if (receipt.status !== "0x1") return { status: "failed", summary: "The transaction failed on the blockchain, so no funds moved." };
  const confirmations = Number(BigInt(head ?? "0x0") - BigInt(receipt.blockNumber)) + 1;
  const need = env().ETH_MIN_CONFIRMATIONS;
  if (method === "eth") {
    if ((tx.to ?? "").toLowerCase() !== address) return { status: "failed", summary: "This transaction does not send ETH to the BETVANTA address." };
    const eth = Number(BigInt(tx.value)) / 1e18;
    if (eth <= 0) return { status: "failed", summary: "The transaction sends no ETH." };
    const details = { hash, amountEth: eth, confirmations, required: need };
    if (confirmations < need) return { status: "pending", summary: `${eth} ETH received, ${confirmations} of ${need} confirmations. Check again later.`, details };
    return { status: "verified", summary: `${eth} ETH received at the BETVANTA address with ${confirmations} confirmations. Confirm the amount covers the plan price.`, details };
  }
  const padded = "0x" + address.slice(2).padStart(64, "0");
  const usdt = receipt.logs
    .filter((l) => l.address.toLowerCase() === USDT_ERC20 && l.topics[0]?.toLowerCase() === TRANSFER_TOPIC && l.topics[2]?.toLowerCase() === padded)
    .reduce((a, l) => a + Number(BigInt(l.data)) / 1e6, 0);
  if (usdt === 0) return { status: "failed", summary: "This transaction does not transfer USDT to the BETVANTA address." };
  const details = { hash, amountUsdt: usdt, confirmations, required: need, planUsd: minUsd };
  if (usdt + 1e-9 < minUsd) return { status: "failed", summary: `Only ${usdt} USDT was received; the plan costs ${minUsd} USDT.`, details };
  if (confirmations < need) return { status: "pending", summary: `${usdt} USDT received, ${confirmations} of ${need} confirmations. Check again later.`, details };
  return { status: "verified", summary: `${usdt} USDT received at the BETVANTA address with ${confirmations} confirmations.`, details };
}

export async function checkOnChain(m: { method: string; customer_reference: string | null; network: string | null; amount_minor: string | number }): Promise<ChainResult> {
  const method = m.method as CryptoMethod;
  const ref = (m.customer_reference ?? "").trim();
  if (!ref) return { status: "unsupported", summary: "No transaction hash was given, so it cannot be checked automatically. Find the payment in the wallet's history or reject and ask for the TXID." };
  if (method === "btc") return /^[0-9a-fA-F]{64}$/.test(ref) ? checkBtc(ref.toLowerCase()) : { status: "failed", summary: "That is not a valid Bitcoin transaction hash." };
  if (method === "eth" || method === "usdt") return /^0x[0-9a-fA-F]{64}$/.test(ref) ? checkEvm(method, ref.toLowerCase(), m.network, Number(m.amount_minor) / 100) : { status: "failed", summary: "That is not a valid Ethereum transaction hash." };
  return { status: "unsupported", summary: "Not a crypto payment." };
}
