import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet, BN, Idl } from "@coral-xyz/anchor";
import { Config, Pool, Pass, PoolInfo, PassInfo, PoolAggregateStats, PassWithAddress, CreatePoolParams, CreatePassParams, AddSegmentParams, ClaimParams, CancelSegmentParams, ChangeSegmentParams } from "./types";
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
     * Get the pass PDA for a pool and holder
     */
    getPassPda(pool: PublicKey, holder: PublicKey): [PublicKey, number];
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
     * Fetch a pass by address
     */
    fetchPass(pass: PublicKey): Promise<Pass | null>;
    /**
     * Fetch a pass by pool and holder
     */
    fetchPassByHolder(pool: PublicKey, holder: PublicKey): Promise<Pass | null>;
    /**
     * Fetch pool with computed info
     */
    getPoolInfo(pool: PublicKey): Promise<PoolInfo | null>;
    /**
     * Fetch pass with computed info
     */
    getPassInfo(pass: PublicKey): Promise<PassInfo | null>;
    /**
     * Initialize the protocol config (one-time setup)
     */
    initializeConfig(admin: Keypair, treasury: PublicKey, feeBps: number): Promise<string>;
    /**
     * Update protocol config (admin only)
     */
    updateConfig(admin: Keypair, newTreasury?: PublicKey, newFeeBps?: number, newAdmin?: PublicKey): Promise<string>;
    /**
     * Create a new pool
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
     * Create a pass (creates pass with first segment)
     * For new passes, segmentIndex is 0. For reactivated expired passes, segments are cleared so index is also 0.
     */
    createPass(holder: Keypair, params: CreatePassParams): Promise<{
        signature: string;
        pass: PublicKey;
        segmentIndex: number;
    }>;
    /**
     * Add a new segment to an existing pass
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
     * Claim vested tokens from multiple passes in a single transaction
     */
    claimBatch(owner: Keypair, params: {
        pool: PublicKey;
        passes: PublicKey[];
        ownerTokenAccount: PublicKey;
    }): Promise<string>;
    /**
     * Build batch claim transactions for all passes in a pool
     * Returns transactions ready to be signed with signAllTransactions
     */
    buildClaimAllTransactions(owner: PublicKey, pool: PublicKey, ownerTokenAccount: PublicKey, batchSize?: number): Promise<{
        transactions: any[];
        totalPasses: number;
    }>;
    /**
     * Cancel a segment (holder only)
     */
    cancelSegment(holder: Keypair, params: CancelSegmentParams): Promise<string>;
    /**
     * Change segment tier (upgrade or downgrade)
     */
    changeSegment(caller: Keypair, params: ChangeSegmentParams): Promise<string>;
    /**
     * Check if a pool exists
     */
    poolExists(owner: PublicKey, name: string): Promise<boolean>;
    /**
     * Check if a pass exists
     */
    passExists(pool: PublicKey, holder: PublicKey): Promise<boolean>;
    /**
     * Get claimable amount for a pass
     */
    getClaimable(pass: PublicKey): Promise<BN>;
    /**
     * Check if pass is expired
     */
    isPassExpired(pass: PublicKey): Promise<boolean>;
    /**
     * Fetch all passes for a pool using getProgramAccounts
     * Pass account layout: [8 discriminator][32 pool][32 holder]...
     * Filter by pool pubkey at offset 8
     */
    fetchPassesByPool(pool: PublicKey): Promise<PassWithAddress[]>;
    /**
     * Calculate real-time aggregate statistics for a pool
     * Fetches all passes and calculates vesting off-chain
     */
    getPoolAggregateStats(pool: PublicKey): Promise<PoolAggregateStats>;
    /**
     * Get real-time claimable amount for a pass (calculated off-chain)
     */
    getRealTimeClaimable(passAddress: PublicKey): Promise<BN>;
    /**
     * Get detailed pass info with real-time vesting calculation
     */
    getPassInfoRealTime(passAddress: PublicKey): Promise<PassInfo | null>;
}
//# sourceMappingURL=client.d.ts.map