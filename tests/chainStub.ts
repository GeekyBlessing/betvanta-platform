import http from "node:http";
// Stand-in for mempool.space (Bitcoin) and Etherscan (Ethereum). Tests register what the blockchain "contains".
export const chain = {
  tip: 1000,
  btc: new Map<string, { vout: { scriptpubkey_address?: string; value: number }[]; status: { confirmed: boolean; block_height?: number } }>(),
  evmHead: 2000,
  evm: new Map<string, { tx: { to: string | null; value: string; blockNumber: string | null; hash: string }; receipt: { status: string; blockNumber: string; logs: { address: string; topics: string[]; data: string }[] } | null }>(),
};
export function startChainStub(port: number) {
  const server = http.createServer((req, res) => {
    const u = new URL(req.url!, "http://x");
    res.setHeader("content-type", "application/json");
    if (u.pathname === "/api/blocks/tip/height") return res.end(String(chain.tip));
    if (u.pathname.startsWith("/api/tx/")) { const t = chain.btc.get(u.pathname.slice(8)); if (!t) { res.statusCode = 404; return res.end("Transaction not found"); } return res.end(JSON.stringify({ txid: u.pathname.slice(8), ...t })); }
    if (u.pathname === "/etherscan") {
      if (u.searchParams.get("apikey") !== "es_unit") return res.end(JSON.stringify({ status: "0", message: "NOTOK", result: "Invalid API Key" }));
      const action = u.searchParams.get("action"), h = (u.searchParams.get("txhash") ?? "").toLowerCase(), e = chain.evm.get(h);
      if (action === "eth_blockNumber") return res.end(JSON.stringify({ jsonrpc: "2.0", id: 1, result: "0x" + chain.evmHead.toString(16) }));
      if (action === "eth_getTransactionByHash") return res.end(JSON.stringify({ jsonrpc: "2.0", id: 1, result: e?.tx ?? null }));
      if (action === "eth_getTransactionReceipt") return res.end(JSON.stringify({ jsonrpc: "2.0", id: 1, result: e?.receipt ?? null }));
    }
    res.statusCode = 404; res.end("{}");
  });
  return new Promise<http.Server>((r) => server.listen(port, "127.0.0.1", () => r(server)));
}
