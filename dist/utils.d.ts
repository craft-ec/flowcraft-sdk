import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
/**
 * Derive the config PDA
 */
export declare function getConfigPda(programId?: PublicKey): [PublicKey, number];
/**
 * Derive the pool PDA for an owner and pool name
 */
export declare function getPoolPda(owner: PublicKey, name: string, programId?: PublicKey): [PublicKey, number];
/**
 * Derive the stream PDA for a pool and subscriber
 */
export declare function getStreamPda(pool: PublicKey, subscriber: PublicKey, programId?: PublicKey): [PublicKey, number];
/**
 * Derive the vault PDA for a pool
 */
export declare function getVaultPda(pool: PublicKey, programId?: PublicKey): [PublicKey, number];
/**
 * Calculate fee amount from gross amount
 */
export declare function calculateFee(amount: BN, feeBps: BN): BN;
/**
 * Calculate net amount after fee deduction
 */
export declare function calculateNetAmount(amount: BN, feeBps: BN): BN;
/**
 * Calculate rate per second from amount and duration
 */
export declare function calculateRate(amount: BN, durationSeconds: BN): BN;
/**
 * Calculate remaining duration from unvested amount and rate
 */
export declare function calculateRemainingDuration(unvested: BN, ratePerSecond: BN): BN;
/**
 * Calculate new cost at a different rate for remaining duration
 */
export declare function calculateUpgradeCost(unvested: BN, currentRate: BN, newRate: BN): {
    newCost: BN;
    difference: BN;
    isUpgrade: boolean;
};
/**
 * Convert BN to number (for display purposes)
 */
export declare function bnToNumber(bn: BN, decimals?: number): number;
/**
 * Convert number to BN with decimals
 */
export declare function numberToBn(num: number, decimals?: number): BN;
/**
 * Format token amount with decimals
 */
export declare function formatTokenAmount(amount: BN, decimals: number): string;
/**
 * Ensure value is BN
 */
export declare function toBN(value: BN | number): BN;
/**
 * Calculate real-time vested amount for a segment based on current time
 */
export declare function calculateSegmentVested(segment: {
    amount: BN;
    vested: BN;
    ratePerSecond: BN;
    cancelled: boolean;
}, lastUpdateTime: BN, currentTime: number): BN;
/**
 * Calculate real-time vesting for an entire stream
 * Returns { totalVested, totalUnvested, claimable, isExpired }
 */
export declare function calculateStreamVesting(stream: {
    segments: Array<{
        amount: BN;
        vested: BN;
        ratePerSecond: BN;
        cancelled: boolean;
    }>;
    lastUpdateTime: BN;
    archivedVested: BN;
    archivedAmount: BN;
    totalWithdrawn: BN;
}, currentTime?: number): {
    totalDeposited: BN;
    totalVested: BN;
    totalUnvested: BN;
    claimable: BN;
    isExpired: boolean;
};
//# sourceMappingURL=utils.d.ts.map