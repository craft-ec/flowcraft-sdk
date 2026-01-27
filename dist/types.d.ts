import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
export interface Config {
    admin: PublicKey;
    treasury: PublicKey;
    feeBps: BN;
    bump: number;
}
export interface Pool {
    owner: PublicKey;
    mint: PublicKey;
    name: string;
    totalPasses: BN;
    totalDeposited: BN;
    totalWithdrawn: BN;
    totalRefunded: BN;
    createdAt: BN;
    bump: number;
}
export interface Segment {
    tier: string;
    payer: PublicKey;
    ratePerSecond: BN;
    amount: BN;
    vested: BN;
    cancelled: boolean;
}
export interface Pass {
    pool: PublicKey;
    holder: PublicKey;
    startTime: BN;
    lastUpdateTime: BN;
    archivedCount: BN;
    archivedAmount: BN;
    archivedVested: BN;
    totalWithdrawn: BN;
    currentSegmentIndex: number;
    bump: number;
    segments: Segment[];
}
export interface CreatePoolParams {
    name: string;
    mint: PublicKey;
}
export interface CreatePassParams {
    pool: PublicKey;
    tier: string;
    amount: BN | number;
    durationSeconds: BN | number;
    holderTokenAccount: PublicKey;
    treasuryTokenAccount: PublicKey;
}
export interface AddSegmentParams {
    pool: PublicKey;
    pass: PublicKey;
    tier: string;
    amount: BN | number;
    durationSeconds: BN | number;
    payerTokenAccount: PublicKey;
    treasuryTokenAccount: PublicKey;
}
export interface ClaimParams {
    pool: PublicKey;
    pass: PublicKey;
    ownerTokenAccount: PublicKey;
}
export interface CancelSegmentParams {
    pool: PublicKey;
    pass: PublicKey;
    segmentIndex: number;
    refundTokenAccount: PublicKey;
}
export interface ChangeSegmentParams {
    pool: PublicKey;
    pass: PublicKey;
    holder: PublicKey;
    segmentIndex: number;
    newTier: string;
    newAmount: BN | number;
    newDuration: BN | number;
    callerTokenAccount: PublicKey;
    payerTokenAccount: PublicKey;
    treasuryTokenAccount: PublicKey;
}
export interface PoolInfo {
    address: PublicKey;
    owner: PublicKey;
    mint: PublicKey;
    name: string;
    totalPasses: number;
    totalDeposited: BN;
    totalWithdrawn: BN;
    totalRefunded: BN;
    createdAt: Date;
}
export interface PassInfo {
    address: PublicKey;
    pool: PublicKey;
    holder: PublicKey;
    startTime: Date;
    totalDeposited: BN;
    totalVested: BN;
    totalWithdrawn: BN;
    claimable: BN;
    activeSegments: number;
    cancelledSegments: number;
    isExpired: boolean;
    segments: SegmentInfo[];
}
export interface SegmentInfo {
    index: number;
    tier: string;
    payer: PublicKey;
    amount: BN;
    vested: BN;
    unvested: BN;
    ratePerSecond: BN;
    cancelled: boolean;
    isComplete: boolean;
}
export interface PoolAggregateStats {
    pool: PublicKey;
    totalPasses: number;
    activePasses: number;
    expiredPasses: number;
    totalDeposited: BN;
    totalVested: BN;
    totalWithdrawn: BN;
    totalClaimable: BN;
    totalUnvested: BN;
    calculatedAt: Date;
}
export interface PassWithAddress {
    address: PublicKey;
    pass: Pass;
}
//# sourceMappingURL=types.d.ts.map