import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet, BN, Idl } from "@coral-xyz/anchor";
import { Config, Pool, Stream, PoolInfo, StreamInfo, PoolAggregateStats, StreamWithAddress, CreatePoolParams, SubscribeParams, AddSegmentParams, ClaimParams, CancelSegmentParams, UpgradeSegmentParams } from "./types";
export declare const IDL: Idl;
export declare class FlowcraftClient {
    readonly program: Program;
    readonly provider: AnchorProvider;
    readonly programId: PublicKey;
    constructor(connection: Connection, wallet: Wallet, programId?: PublicKey, idl?: Idl);
    /**
     * Get the config PDA
     */
    getConfigPda(): [PublicKey, number];
    /**
     * Get the pool PDA for an owner and name
     */
    getPoolPda(owner: PublicKey, name: string): [PublicKey, number];
    /**
     * Get the stream PDA for a pool and subscriber
     */
    getStreamPda(pool: PublicKey, subscriber: PublicKey): [PublicKey, number];
    /**
     * Get the vault PDA for a pool
     */
    getVaultPda(pool: PublicKey): [PublicKey, number];
    /**
     * Fetch the global config
     */
    fetchConfig(): Promise<Config | null>;
    /**
     * Fetch a pool by address
     */
    fetchPool(pool: PublicKey): Promise<Pool | null>;
    /**
     * Fetch a pool by owner and name
     */
    fetchPoolByOwner(owner: PublicKey, name: string): Promise<Pool | null>;
    /**
     * Fetch a stream by address
     */
    fetchStream(stream: PublicKey): Promise<Stream | null>;
    /**
     * Fetch a stream by pool and subscriber
     */
    fetchStreamBySubscriber(pool: PublicKey, subscriber: PublicKey): Promise<Stream | null>;
    /**
     * Fetch pool with computed info
     */
    getPoolInfo(pool: PublicKey): Promise<PoolInfo | null>;
    /**
     * Fetch stream with computed info
     */
    getStreamInfo(stream: PublicKey): Promise<StreamInfo | null>;
    /**
     * Initialize the protocol config (one-time setup)
     */
    initializeConfig(admin: Keypair, treasury: PublicKey, feeBps: number): Promise<string>;
    /**
     * Update protocol config (admin only)
     */
    updateConfig(admin: Keypair, newTreasury?: PublicKey, newFeeBps?: number, newAdmin?: PublicKey): Promise<string>;
    /**
     * Create a new subscription pool
     * @param payer - Keypair that pays for rent (signs the transaction)
     * @param owner - PublicKey of pool owner (can be any account, including PDA)
     * @param params - Pool creation parameters
     */
    createPool(payer: Keypair, owner: PublicKey, params: CreatePoolParams): Promise<{
        signature: string;
        pool: PublicKey;
        vault: PublicKey;
    }>;
    /**
     * Subscribe to a pool (creates stream with first segment)
     * For new streams, segmentIndex is 0. For reactivated expired streams, segments are cleared so index is also 0.
     */
    subscribe(subscriber: Keypair, params: SubscribeParams): Promise<{
        signature: string;
        stream: PublicKey;
        segmentIndex: number;
    }>;
    /**
     * Add a new segment to an existing subscription
     */
    addSegment(payer: Keypair, params: AddSegmentParams): Promise<{
        signature: string;
        segmentIndex: number;
    }>;
    /**
     * Claim vested tokens (pool owner only)
     */
    claim(owner: Keypair, params: ClaimParams): Promise<string>;
    /**
     * Claim vested tokens from multiple streams in a single transaction
     */
    claimBatch(owner: Keypair, params: {
        pool: PublicKey;
        streams: PublicKey[];
        ownerTokenAccount: PublicKey;
    }): Promise<string>;
    /**
     * Build batch claim transactions for all streams in a pool
     * Returns transactions ready to be signed with signAllTransactions
     */
    buildClaimAllTransactions(owner: PublicKey, pool: PublicKey, ownerTokenAccount: PublicKey, batchSize?: number): Promise<{
        transactions: any[];
        totalStreams: number;
    }>;
    /**
     * Cancel a segment (subscriber only)
     */
    cancelSegment(subscriber: Keypair, params: CancelSegmentParams): Promise<string>;
    /**
     * Upgrade or downgrade a segment
     */
    upgradeSegment(caller: Keypair, params: UpgradeSegmentParams): Promise<string>;
    /**
     * Check if a pool exists
     */
    poolExists(owner: PublicKey, name: string): Promise<boolean>;
    /**
     * Check if a subscription stream exists
     */
    subscriptionExists(pool: PublicKey, subscriber: PublicKey): Promise<boolean>;
    /**
     * Get claimable amount for a stream
     */
    getClaimable(stream: PublicKey): Promise<BN>;
    /**
     * Check if subscription is expired
     */
    isSubscriptionExpired(stream: PublicKey): Promise<boolean>;
    /**
     * Fetch all streams for a pool using getProgramAccounts
     * Stream account layout: [8 discriminator][32 pool][32 subscriber]...
     * Filter by pool pubkey at offset 8
     */
    fetchStreamsByPool(pool: PublicKey): Promise<StreamWithAddress[]>;
    /**
     * Calculate real-time aggregate statistics for a pool
     * Fetches all streams and calculates vesting off-chain
     */
    getPoolAggregateStats(pool: PublicKey): Promise<PoolAggregateStats>;
    /**
     * Get real-time claimable amount for a stream (calculated off-chain)
     */
    getRealTimeClaimable(streamAddress: PublicKey): Promise<BN>;
    /**
     * Get detailed stream info with real-time vesting calculation
     */
    getStreamInfoRealTime(streamAddress: PublicKey): Promise<StreamInfo | null>;
}
//# sourceMappingURL=client.d.ts.map