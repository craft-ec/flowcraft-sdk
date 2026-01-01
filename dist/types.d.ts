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
    totalSubscribers: BN;
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
export interface Stream {
    pool: PublicKey;
    subscriber: PublicKey;
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
export interface SubscribeParams {
    pool: PublicKey;
    tier: string;
    amount: BN | number;
    durationSeconds: BN | number;
    subscriberTokenAccount: PublicKey;
    treasuryTokenAccount: PublicKey;
}
export interface AddSegmentParams {
    pool: PublicKey;
    stream: PublicKey;
    tier: string;
    amount: BN | number;
    durationSeconds: BN | number;
    payerTokenAccount: PublicKey;
    treasuryTokenAccount: PublicKey;
}
export interface ClaimParams {
    pool: PublicKey;
    stream: PublicKey;
    ownerTokenAccount: PublicKey;
}
export interface CancelSegmentParams {
    pool: PublicKey;
    stream: PublicKey;
    segmentIndex: number;
    refundTokenAccount: PublicKey;
}
export interface UpgradeSegmentParams {
    pool: PublicKey;
    stream: PublicKey;
    subscriber: PublicKey;
    segmentIndex: number;
    newAmount: BN | number;
    newDuration: BN | number;
    callerTokenAccount: PublicKey;
    payerTokenAccount: PublicKey;
}
export interface PoolInfo {
    address: PublicKey;
    owner: PublicKey;
    mint: PublicKey;
    name: string;
    totalSubscribers: number;
    totalDeposited: BN;
    totalWithdrawn: BN;
    totalRefunded: BN;
    createdAt: Date;
}
export interface StreamInfo {
    address: PublicKey;
    pool: PublicKey;
    subscriber: PublicKey;
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
    totalStreams: number;
    activeStreams: number;
    expiredStreams: number;
    totalDeposited: BN;
    totalVested: BN;
    totalWithdrawn: BN;
    totalClaimable: BN;
    totalUnvested: BN;
    calculatedAt: Date;
}
export interface StreamWithAddress {
    address: PublicKey;
    stream: Stream;
}
//# sourceMappingURL=types.d.ts.map