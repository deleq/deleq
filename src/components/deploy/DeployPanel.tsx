"use client";

import { useState } from "react";
import { useWallet } from "@/components/wallet/WalletProvider";
import { useWalletModal } from "@/components/wallet/WalletButton";
import { CHAIN, explorerAddress, explorerTx } from "@/config/brand";
import { explain, waitForReceipt } from "@/lib/client";
import artifacts from "@/lib/contracts/artifacts.json";

/** forge gas report, 24 Nov 2026: 2,954,194 gas for the creation transaction (13,365 bytes of runtime code). */
export const DEPLOY_GAS = "about 3.0 million";

export function DeployPanel() {
  const { address, onChain, sendTransaction, switchNetwork } = useWallet();
  const { open } = useWalletModal();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState<{ address: string; tx: string; block: number } | null>(null);
  const art = artifacts.contracts.DeleqMandateGuard;

  async function deploy() {
    if (!address) return open();
    if (!onChain) return switchNetwork();
    setBusy(true);
    setMsg(null);
    try {
      const hash = await sendTransaction({ data: art.creation as `0x${string}` });
      setMsg(`Sent ${hash}. Waiting for the block…`);
      const rc = await waitForReceipt(hash, 300_000);
      if (!rc.ok || !rc.contractAddress) throw new Error("The deployment reverted.");
      setDone({ address: rc.contractAddress, tx: hash, block: rc.blockNumber });
      setMsg(null);
    } catch (e) {
      setMsg(explain(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="panel panel-b" data-testid="deploy-panel">
        <h2 className="display h-card">DeleqMandateGuard</h2>
        <p className="small mt-2">No constructor arguments, no owner of the contract. Creation code sha256 {art.sha256.slice(0, 16)}…</p>
        <button type="button" className="btn btn-blue mt-5 w-full" disabled={busy} onClick={deploy} data-testid="deploy-submit">
          {!address ? "Connect wallet" : !onChain ? `Switch to ${CHAIN.name}` : busy ? "Confirm in wallet…" : `Deploy on ${CHAIN.name}`}
        </button>
        {msg ? (
          <p className="rq-alert mt-3" role="status">
            {msg}
          </p>
        ) : null}
        {done ? (
          <div className="mt-4 text-[13px] leading-relaxed" data-testid="deploy-done">
            <p className="font-semibold">Deployed.</p>
            <p className="break-all">
              Address{" "}
              <a className="underline" href={explorerAddress(done.address)} target="_blank" rel="noreferrer">
                {done.address}
              </a>
              <br />
              Tx{" "}
              <a className="underline" href={explorerTx(done.tx)} target="_blank" rel="noreferrer">
                {done.tx}
              </a>{" "}
              · block {done.block}
            </p>
            <p className="mt-2">
              Paste into src/config/contracts.ts: <code className="break-all">{`guard: "${done.address}", block: ${done.block}, tx: "${done.tx}"`}</code>. Then run{" "}
              <code className="break-all">
                npm run verify-deployment -- --guard {done.address} --guard-tx {done.tx}
              </code>{" "}
              and verify the source with the kit in referensi/explorer.
            </p>
          </div>
        ) : null}
      </div>
      <div className="panel panel-b">
        <h2 className="display h-card">Before you deploy</h2>
        <ul className="small mt-3 grid list-disc gap-2 pl-5">
          <li>The guard never holds a balance at rest and has no payable function or receive(). It moves owners&apos; tokens only under their own ERC-20 allowance.</li>
          <li>It has unit, fuzz, invariant and Robinhood Chain fork tests and a written self-review, but no outside security review yet. Start with small amounts.</li>
          <li>Measured deploy gas: {DEPLOY_GAS}, paid in {CHAIN.nativeSymbol}.</li>
        </ul>
      </div>
    </div>
  );
}
