import { ChildProcess, spawn } from "child_process";
import { resolve } from "path";

let vaultProcess: ChildProcess | null = null;

/**
 * Offers/redemption genuinely crosses services (Core -> Vault, for the relay
 * mapping). Testing that honestly means Vault has to actually be listening —
 * not mocked around — so this spawns the real built process, same as a real
 * deployment, and waits for it to answer /health before tests proceed.
 */
export async function startVaultForTest(): Promise<void> {
  const vaultMain = resolve(__dirname, "../../vault/dist/main.js");
  vaultProcess = spawn("node", [vaultMain], {
    env: process.env,
    stdio: "ignore",
  });

  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${process.env.VAULT_INTERNAL_URL}/health`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("Vault test process did not become healthy in time");
}

export function stopVaultForTest(): void {
  vaultProcess?.kill();
  vaultProcess = null;
}
