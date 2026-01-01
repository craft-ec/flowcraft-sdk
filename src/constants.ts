import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey(
  "3T8z77gRqyW6KZQBHf1ah2uKABh9vc5rSTaD595U2wm9"
);

export const RATE_DECIMALS = 1_000_000_000n;
export const BPS_DENOMINATOR = 10_000n;
export const MAX_FEE_BPS = 1_000n; // 10%
export const MAX_SEGMENTS = 100;

// Seeds for PDA derivation
export const CONFIG_SEED = "config";
export const POOL_SEED = "pool";
export const STREAM_SEED = "stream";
export const VAULT_SEED = "vault";
