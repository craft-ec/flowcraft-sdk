import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
  PROGRAM_ID,
  CONFIG_SEED,
  POOL_SEED,
  STREAM_SEED,
  VAULT_SEED,
  RATE_DECIMALS,
  BPS_DENOMINATOR,
} from "./constants";

/**
 * Derive the config PDA
 */
export function getConfigPda(programId: PublicKey = PROGRAM_ID): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(CONFIG_SEED)],
    programId
  );
}

/**
 * Derive the pool PDA for an owner and pool name
 */
export function getPoolPda(
  owner: PublicKey,
  name: string,
  programId: PublicKey = PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(POOL_SEED), owner.toBuffer(), Buffer.from(name)],
    programId
  );
}

/**
 * Derive the stream PDA for a pool and subscriber
 */
export function getStreamPda(
  pool: PublicKey,
  subscriber: PublicKey,
  programId: PublicKey = PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(STREAM_SEED), pool.toBuffer(), subscriber.toBuffer()],
    programId
  );
}

/**
 * Derive the vault PDA for a pool
 */
export function getVaultPda(
  pool: PublicKey,
  programId: PublicKey = PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(VAULT_SEED), pool.toBuffer()],
    programId
  );
}

/**
 * Calculate fee amount from gross amount
 */
export function calculateFee(amount: BN, feeBps: BN): BN {
  return amount.mul(feeBps).div(new BN(BPS_DENOMINATOR.toString()));
}

/**
 * Calculate net amount after fee deduction
 */
export function calculateNetAmount(amount: BN, feeBps: BN): BN {
  const fee = calculateFee(amount, feeBps);
  return amount.sub(fee);
}

/**
 * Calculate rate per second from amount and duration
 */
export function calculateRate(amount: BN, durationSeconds: BN): BN {
  return amount
    .mul(new BN(RATE_DECIMALS.toString()))
    .div(durationSeconds);
}

/**
 * Calculate remaining duration from unvested amount and rate
 */
export function calculateRemainingDuration(unvested: BN, ratePerSecond: BN): BN {
  return unvested
    .mul(new BN(RATE_DECIMALS.toString()))
    .div(ratePerSecond);
}

/**
 * Calculate new cost at a different rate for remaining duration
 */
export function calculateUpgradeCost(
  unvested: BN,
  currentRate: BN,
  newRate: BN
): { newCost: BN; difference: BN; isUpgrade: boolean } {
  const remainingDuration = calculateRemainingDuration(unvested, currentRate);
  const newCost = remainingDuration
    .mul(newRate)
    .div(new BN(RATE_DECIMALS.toString()));

  const isUpgrade = newCost.gt(unvested);
  const difference = isUpgrade
    ? newCost.sub(unvested)
    : unvested.sub(newCost);

  return { newCost, difference, isUpgrade };
}

/**
 * Convert BN to number (for display purposes)
 */
export function bnToNumber(bn: BN, decimals: number = 0): number {
  if (decimals === 0) return bn.toNumber();
  return bn.toNumber() / Math.pow(10, decimals);
}

/**
 * Convert number to BN with decimals
 */
export function numberToBn(num: number, decimals: number = 0): BN {
  return new BN(Math.floor(num * Math.pow(10, decimals)));
}

/**
 * Format token amount with decimals
 */
export function formatTokenAmount(amount: BN, decimals: number): string {
  const str = amount.toString().padStart(decimals + 1, "0");
  const intPart = str.slice(0, -decimals) || "0";
  const decPart = str.slice(-decimals);
  return `${intPart}.${decPart}`;
}

/**
 * Ensure value is BN
 */
export function toBN(value: BN | number): BN {
  return typeof value === "number" ? new BN(value) : value;
}

/**
 * Calculate real-time vested amount for a segment based on current time
 */
export function calculateSegmentVested(
  segment: { amount: BN; vested: BN; ratePerSecond: BN; cancelled: boolean },
  lastUpdateTime: BN,
  currentTime: number
): BN {
  if (segment.cancelled) {
    return segment.vested;
  }

  const elapsed = new BN(currentTime).sub(lastUpdateTime);
  if (elapsed.lten(0)) {
    return segment.vested;
  }

  const additionalVested = elapsed
    .mul(segment.ratePerSecond)
    .div(new BN(RATE_DECIMALS.toString()));

  const unvested = segment.amount.sub(segment.vested);
  const newVested = BN.min(additionalVested, unvested);

  return segment.vested.add(newVested);
}

/**
 * Calculate real-time vesting for an entire stream
 * Returns { totalVested, totalUnvested, claimable, isExpired }
 */
export function calculateStreamVesting(
  stream: {
    segments: Array<{ amount: BN; vested: BN; ratePerSecond: BN; cancelled: boolean }>;
    lastUpdateTime: BN;
    archivedVested: BN;
    archivedAmount: BN;
    totalWithdrawn: BN;
  },
  currentTime: number = Math.floor(Date.now() / 1000)
): {
  totalDeposited: BN;
  totalVested: BN;
  totalUnvested: BN;
  claimable: BN;
  isExpired: boolean;
} {
  let totalDeposited = stream.archivedAmount;
  let totalVested = stream.archivedVested;
  let remainingTime = new BN(currentTime).sub(stream.lastUpdateTime);
  let allComplete = true;

  for (const segment of stream.segments) {
    totalDeposited = totalDeposited.add(segment.amount);

    if (segment.cancelled) {
      totalVested = totalVested.add(segment.vested);
      continue;
    }

    const unvested = segment.amount.sub(segment.vested);
    if (unvested.gtn(0)) {
      // Calculate how much time this segment needs
      const timeNeeded = unvested
        .mul(new BN(RATE_DECIMALS.toString()))
        .div(segment.ratePerSecond);

      if (remainingTime.gte(timeNeeded)) {
        // Segment fully vests
        totalVested = totalVested.add(segment.amount);
        remainingTime = remainingTime.sub(timeNeeded);
      } else {
        // Partial vesting
        const additionalVested = remainingTime
          .mul(segment.ratePerSecond)
          .div(new BN(RATE_DECIMALS.toString()));
        totalVested = totalVested.add(segment.vested).add(additionalVested);
        remainingTime = new BN(0);
        allComplete = false;
      }
    } else {
      totalVested = totalVested.add(segment.vested);
    }
  }

  const totalUnvested = totalDeposited.sub(totalVested);
  const claimable = totalVested.sub(stream.totalWithdrawn);

  return {
    totalDeposited,
    totalVested,
    totalUnvested,
    claimable: claimable.gtn(0) ? claimable : new BN(0),
    isExpired: allComplete && totalUnvested.eqn(0),
  };
}
