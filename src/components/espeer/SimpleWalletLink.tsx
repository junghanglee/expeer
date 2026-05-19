import { useState } from "react";
import { Wallet as WalletIcon, QrCode, Loader2, Link2 } from "lucide-react";
import { QrScanner } from "./QrScanner";
import { useEvmWallet, shortAddress } from "@/hooks/useEvmWallet";

const ASSETS = ["USDT", "USDC", "BTC", "ETH"];
const NETWORKS: Record<string, string[]> = {
  USDT: ["TRC20", "ERC20", "BEP20", "Base Sepolia"],
  USDC: ["Base Sepolia", "ERC20", "BEP20", "Polygon"],
  BTC: ["Bitcoin"],
  ETH: ["ERC20"],
};
const EVM_NETWORKS = new Set(["ERC20", "BEP20", "Polygon", "Base Sepolia", "Base"]);

export function SimpleWalletLink({
  onAdd,
  busy,
}: {
  onAdd: (input: { asset: string; network: string; address: string }) => Promise<void> | void;
  busy?: boolean;
}) {
  const [asset, setAsset] = useState("USDT");
  const [network, setNetwork] = useState("TRC20");
  const [address, setAddress] = useState("");
  const [scanning, setScanning] = useState(false);
  const evm = useEvmWallet();
  const isEvmNet = EVM_NETWORKS.has(network);

  const submit = async () => {
    if (!address.trim()) return;
    await onAdd({ asset, network, address: address.trim() });
    setAddress("");
  };

  const connectEvm = async () => {
    const a = await evm.connect();
    if (a) setAddress(a);
  };

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div>
        <div className="mb-1 text-[11px] font-semibold text-muted-foreground">자산</div>
        <div className="flex flex-wrap gap-1.5">
          {ASSETS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => {
                setAsset(a);
                setNetwork(NETWORKS[a][0]);
              }}
              className={`rounded-lg px-3 py-1.5 text-[12px] font-bold ${
                asset === a ? "bg-primary text-primary-foreground" : "bg-surface text-foreground"
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1 text-[11px] font-semibold text-muted-foreground">네트워크</div>
        <div className="flex flex-wrap gap-1.5">
          {NETWORKS[asset].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setNetwork(n)}
              className={`rounded-lg px-3 py-1.5 text-[12px] font-bold ${
                network === n ? "bg-primary-soft text-primary" : "bg-surface text-muted-foreground"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-muted-foreground">지갑 주소</span>
          <div className="flex items-center gap-1.5">
            {isEvmNet && evm.hasProvider && (
              <button
                type="button"
                onClick={connectEvm}
                disabled={evm.connecting}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-bold text-primary-foreground disabled:opacity-50"
                title={evm.address ? shortAddress(evm.address) : "MetaMask 연결"}
              >
                <Link2 className="h-3 w-3" />
                {evm.address ? shortAddress(evm.address) : "MetaMask 연결"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setScanning(true)}
              className="inline-flex items-center gap-1 rounded-md bg-primary-soft px-2 py-1 text-[11px] font-bold text-primary"
            >
              <QrCode className="h-3 w-3" /> QR
            </button>
          </div>
        </div>
        {evm.error && isEvmNet && (
          <div className="mb-1 text-[11px] text-destructive">{evm.error}</div>
        )}
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="주소를 직접 입력하거나 QR 스캔"
          className="w-full rounded-xl bg-surface px-3 py-2.5 font-mono text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
      <button
        onClick={submit}
        disabled={busy || !address.trim()}
        className="flex w-full items-center justify-center gap-1 rounded-xl bg-primary py-3 text-[14px] font-bold text-primary-foreground disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <WalletIcon className="h-4 w-4" />}
        지갑 연결
      </button>
      {scanning && (
        <QrScanner
          onScan={(text) => {
            setAddress(text);
            setScanning(false);
          }}
          onClose={() => setScanning(false)}
        />
      )}
    </div>
  );
}
