import {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
} from "@solana/web3.js";
import {
  Program,
  AnchorProvider,
  Wallet,
  BN,
  Idl,
} from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PROGRAM_ID } from "./constants";
import {
  Config,
  Pool,
  Stream,
  PoolInfo,
  StreamInfo,
  SegmentInfo,
  PoolAggregateStats,
  StreamWithAddress,
  CreatePoolParams,
  SubscribeParams,
  AddSegmentParams,
  ClaimParams,
  CancelSegmentParams,
  UpgradeSegmentParams,
} from "./types";
import {
  getConfigPda,
  getPoolPda,
  getStreamPda,
  getVaultPda,
  toBN,
  calculateStreamVesting,
} from "./utils";

// Import IDL from generated file
import IDL_JSON from "./idl.json";
export const IDL: Idl = IDL_JSON as Idl;

export class FlowcraftClient {
  readonly program: Program;
  readonly provider: AnchorProvider;
  readonly programId: PublicKey;

  constructor(
    connection: Connection,
    wallet: Wallet,
    programId: PublicKey = PROGRAM_ID,
    idl: Idl = IDL
  ) {
    this.programId = programId;
    this.provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
    this.program = new Program(idl, this.provider);
  }

  // ============================================================================
  // PDA Helpers
  // ============================================================================

  /**
   * Get the config PDA
   */
  getConfigPda(): [PublicKey, number] {
    return getConfigPda(this.programId);
  }

  /**
   * Get the pool PDA for an owner and name
   */
  getPoolPda(owner: PublicKey, name: string): [PublicKey, number] {
    return getPoolPda(owner, name, this.programId);
  }

  /**
   * Get the stream PDA for a pool and subscriber
   */
  getStreamPda(pool: PublicKey, subscriber: PublicKey): [PublicKey, number] {
    return getStreamPda(pool, subscriber, this.programId);
  }

  /**
   * Get the vault PDA for a pool
   */
  getVaultPda(pool: PublicKey): [PublicKey, number] {
    return getVaultPda(pool, this.programId);
  }

  // ============================================================================
  // Fetch Methods
  // ============================================================================

  /**
   * Fetch the global config
   */
  async fetchConfig(): Promise<Config | null> {
    try {
      const [configPda] = this.getConfigPda();
      const account = await (this.program.account as any).config.fetch(configPda);
      return account as Config;
    } catch {
      return null;
    }
  }

  /**
   * Fetch a pool by address
   */
  async fetchPool(pool: PublicKey): Promise<Pool | null> {
    try {
      const account = await (this.program.account as any).pool.fetch(pool);
      return account as Pool;
    } catch {
      return null;
    }
  }

  /**
   * Fetch a pool by owner and name
   */
  async fetchPoolByOwner(owner: PublicKey, name: string): Promise<Pool | null> {
    const [poolPda] = this.getPoolPda(owner, name);
    return this.fetchPool(poolPda);
  }

  /**
   * Fetch a stream by address
   */
  async fetchStream(stream: PublicKey): Promise<Stream | null> {
    try {
      const account = await (this.program.account as any).stream.fetch(stream);
      return account as Stream;
    } catch {
      return null;
    }
  }

  /**
   * Fetch a stream by pool and subscriber
   */
  async fetchStreamBySubscriber(
    pool: PublicKey,
    subscriber: PublicKey
  ): Promise<Stream | null> {
    const [streamPda] = this.getStreamPda(pool, subscriber);
    return this.fetchStream(streamPda);
  }

  /**
   * Fetch pool with computed info
   */
  async getPoolInfo(pool: PublicKey): Promise<PoolInfo | null> {
    const poolData = await this.fetchPool(pool);
    if (!poolData) return null;

    return {
      address: pool,
      owner: poolData.owner,
      mint: poolData.mint,
      name: poolData.name,
      totalSubscribers: poolData.totalSubscribers.toNumber(),
      totalDeposited: poolData.totalDeposited,
      totalWithdrawn: poolData.totalWithdrawn,
      totalRefunded: poolData.totalRefunded,
      createdAt: new Date(poolData.createdAt.toNumber() * 1000),
    };
  }

  /**
   * Fetch stream with computed info
   */
  async getStreamInfo(stream: PublicKey): Promise<StreamInfo | null> {
    const streamData = await this.fetchStream(stream);
    if (!streamData) return null;

    let totalDeposited = streamData.archivedAmount;
    let totalVested = streamData.archivedVested;
    let activeSegments = 0;
    let cancelledSegments = 0;

    const segments: SegmentInfo[] = streamData.segments.map((seg, index) => {
      totalDeposited = totalDeposited.add(seg.amount);
      totalVested = totalVested.add(seg.vested);

      if (seg.cancelled) {
        cancelledSegments++;
      } else if (!seg.vested.eq(seg.amount)) {
        activeSegments++;
      }

      return {
        index,
        tier: seg.tier,
        payer: seg.payer,
        amount: seg.amount,
        vested: seg.vested,
        unvested: seg.amount.sub(seg.vested),
        ratePerSecond: seg.ratePerSecond,
        cancelled: seg.cancelled,
        isComplete: seg.vested.eq(seg.amount) || seg.cancelled,
      };
    });

    const claimable = totalVested.sub(streamData.totalWithdrawn);
    const isExpired = streamData.segments.every(
      (s) => s.vested.eq(s.amount) || s.cancelled
    );

    return {
      address: stream,
      pool: streamData.pool,
      subscriber: streamData.subscriber,
      startTime: new Date(streamData.startTime.toNumber() * 1000),
      totalDeposited,
      totalVested,
      totalWithdrawn: streamData.totalWithdrawn,
      claimable,
      activeSegments,
      cancelledSegments,
      isExpired,
      segments,
    };
  }

  // ============================================================================
  // Admin Instructions
  // ============================================================================

  /**
   * Initialize the protocol config (one-time setup)
   */
  async initializeConfig(
    admin: Keypair,
    treasury: PublicKey,
    feeBps: number
  ): Promise<string> {
    const [configPda] = this.getConfigPda();

    return await this.program.methods
      .initializeConfig(treasury, new BN(feeBps))
      .accounts({
        admin: admin.publicKey,
        config: configPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([admin])
      .rpc();
  }

  /**
   * Update protocol config (admin only)
   */
  async updateConfig(
    admin: Keypair,
    newTreasury?: PublicKey,
    newFeeBps?: number,
    newAdmin?: PublicKey
  ): Promise<string> {
    const [configPda] = this.getConfigPda();

    return await this.program.methods
      .updateConfig(
        newTreasury ?? null,
        newFeeBps !== undefined ? new BN(newFeeBps) : null,
        newAdmin ?? null
      )
      .accounts({
        admin: admin.publicKey,
        config: configPda,
      })
      .signers([admin])
      .rpc();
  }

  // ============================================================================
  // Pool Instructions
  // ============================================================================

  /**
   * Create a new subscription pool
   * @param payer - Keypair that pays for rent (signs the transaction)
   * @param owner - PublicKey of pool owner (can be any account, including PDA)
   * @param params - Pool creation parameters
   */
  async createPool(
    payer: Keypair,
    owner: PublicKey,
    params: CreatePoolParams
  ): Promise<{ signature: string; pool: PublicKey; vault: PublicKey }> {
    const [poolPda] = this.getPoolPda(owner, params.name);
    const [vaultPda] = this.getVaultPda(poolPda);

    const signature = await this.program.methods
      .createPool(params.name)
      .accounts({
        payer: payer.publicKey,
        owner: owner,
        mint: params.mint,
        pool: poolPda,
        vault: vaultPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([payer])
      .rpc();

    return { signature, pool: poolPda, vault: vaultPda };
  }

  // ============================================================================
  // Subscription Instructions
  // ============================================================================

  /**
   * Subscribe to a pool (creates stream with first segment)
   * For new streams, segmentIndex is 0. For reactivated expired streams, segments are cleared so index is also 0.
   */
  async subscribe(
    subscriber: Keypair,
    params: SubscribeParams
  ): Promise<{ signature: string; stream: PublicKey; segmentIndex: number }> {
    const [configPda] = this.getConfigPda();
    const [streamPda] = this.getStreamPda(params.pool, subscriber.publicKey);
    const [vaultPda] = this.getVaultPda(params.pool);

    // Check if stream exists and get current segment count
    let segmentIndex = 0;
    try {
      const existingStream = await this.fetchStream(streamPda);
      if (existingStream) {
        // Check if stream is expired (all segments fully vested or cancelled)
        const isExpired = existingStream.segments.every(
          (s) => s.vested.eq(s.amount) || s.cancelled
        );
        // If expired, segments will be cleared; otherwise add to existing
        segmentIndex = isExpired ? 0 : existingStream.segments.length;
      }
    } catch {
      // New stream - segment index is 0
    }

    const signature = await this.program.methods
      .subscribe(params.tier, toBN(params.amount), toBN(params.durationSeconds))
      .accounts({
        subscriber: subscriber.publicKey,
        pool: params.pool,
        config: configPda,
        stream: streamPda,
        vault: vaultPda,
        subscriberTokenAccount: params.subscriberTokenAccount,
        treasuryTokenAccount: params.treasuryTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([subscriber])
      .rpc();

    return { signature, stream: streamPda, segmentIndex };
  }

  /**
   * Add a new segment to an existing subscription
   */
  async addSegment(
    payer: Keypair,
    params: AddSegmentParams
  ): Promise<{ signature: string; segmentIndex: number }> {
    const [configPda] = this.getConfigPda();
    const [vaultPda] = this.getVaultPda(params.pool);

    // Fetch stream to get current segment count
    const stream = await this.fetchStream(params.stream);
    if (!stream) {
      throw new Error("Stream not found");
    }
    const segmentIndex = stream.segments.length;

    const signature = await this.program.methods
      .addSegment(params.tier, toBN(params.amount), toBN(params.durationSeconds))
      .accounts({
        payer: payer.publicKey,
        pool: params.pool,
        config: configPda,
        stream: params.stream,
        vault: vaultPda,
        payerTokenAccount: params.payerTokenAccount,
        treasuryTokenAccount: params.treasuryTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([payer])
      .rpc();

    return { signature, segmentIndex };
  }

  /**
   * Claim vested tokens (pool owner only)
   */
  async claim(
    owner: Keypair,
    params: ClaimParams
  ): Promise<string> {
    const [vaultPda] = this.getVaultPda(params.pool);

    return await this.program.methods
      .claim()
      .accounts({
        owner: owner.publicKey,
        pool: params.pool,
        stream: params.stream,
        vault: vaultPda,
        ownerTokenAccount: params.ownerTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([owner])
      .rpc();
  }

  /**
   * Claim vested tokens from multiple streams in a single transaction
   */
  async claimBatch(
    owner: Keypair,
    params: {
      pool: PublicKey;
      streams: PublicKey[];
      ownerTokenAccount: PublicKey;
    }
  ): Promise<string> {
    const [vaultPda] = this.getVaultPda(params.pool);

    return await this.program.methods
      .claimBatch()
      .accounts({
        owner: owner.publicKey,
        pool: params.pool,
        vault: vaultPda,
        ownerTokenAccount: params.ownerTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .remainingAccounts(
        params.streams.map((stream) => ({
          pubkey: stream,
          isSigner: false,
          isWritable: true,
        }))
      )
      .signers([owner])
      .rpc();
  }

  /**
   * Build batch claim transactions for all streams in a pool
   * Returns transactions ready to be signed with signAllTransactions
   */
  async buildClaimAllTransactions(
    owner: PublicKey,
    pool: PublicKey,
    ownerTokenAccount: PublicKey,
    batchSize: number = 20
  ): Promise<{ transactions: any[]; totalStreams: number }> {
    // Fetch all streams for this pool
    const streams = await this.fetchStreamsByPool(pool);
    const streamAddresses = streams.map((s: StreamWithAddress) => s.address);

    const [vaultPda] = this.getVaultPda(pool);
    const transactions: any[] = [];

    // Split into batches
    for (let i = 0; i < streamAddresses.length; i += batchSize) {
      const batch = streamAddresses.slice(i, i + batchSize);

      const tx = await this.program.methods
        .claimBatch()
        .accounts({
          owner,
          pool,
          vault: vaultPda,
          ownerTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .remainingAccounts(
          batch.map((pubkey: PublicKey) => ({
            pubkey,
            isSigner: false,
            isWritable: true,
          }))
        )
        .transaction();

      transactions.push(tx);
    }

    return { transactions, totalStreams: streamAddresses.length };
  }

  /**
   * Cancel a segment (subscriber only)
   */
  async cancelSegment(
    subscriber: Keypair,
    params: CancelSegmentParams
  ): Promise<string> {
    const [vaultPda] = this.getVaultPda(params.pool);

    return await this.program.methods
      .cancelSegment(params.segmentIndex)
      .accounts({
        subscriber: subscriber.publicKey,
        pool: params.pool,
        stream: params.stream,
        vault: vaultPda,
        refundTokenAccount: params.refundTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([subscriber])
      .rpc();
  }

  /**
   * Upgrade or downgrade a segment
   */
  async upgradeSegment(
    caller: Keypair,
    params: UpgradeSegmentParams
  ): Promise<string> {
    const [vaultPda] = this.getVaultPda(params.pool);

    return await this.program.methods
      .upgradeSegment(
        params.segmentIndex,
        toBN(params.newAmount),
        toBN(params.newDuration)
      )
      .accounts({
        caller: caller.publicKey,
        subscriber: params.subscriber,
        pool: params.pool,
        stream: params.stream,
        vault: vaultPda,
        callerTokenAccount: params.callerTokenAccount,
        payerTokenAccount: params.payerTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([caller])
      .rpc();
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Check if a pool exists
   */
  async poolExists(owner: PublicKey, name: string): Promise<boolean> {
    const pool = await this.fetchPoolByOwner(owner, name);
    return pool !== null;
  }

  /**
   * Check if a subscription stream exists
   */
  async subscriptionExists(pool: PublicKey, subscriber: PublicKey): Promise<boolean> {
    const stream = await this.fetchStreamBySubscriber(pool, subscriber);
    return stream !== null;
  }

  /**
   * Get claimable amount for a stream
   */
  async getClaimable(stream: PublicKey): Promise<BN> {
    const info = await this.getStreamInfo(stream);
    return info?.claimable ?? new BN(0);
  }

  /**
   * Check if subscription is expired
   */
  async isSubscriptionExpired(stream: PublicKey): Promise<boolean> {
    const info = await this.getStreamInfo(stream);
    return info?.isExpired ?? true;
  }

  // ============================================================================
  // Pool Analytics (Off-chain Calculation)
  // ============================================================================

  /**
   * Fetch all streams for a pool using getProgramAccounts
   * Stream account layout: [8 discriminator][32 pool][32 subscriber]...
   * Filter by pool pubkey at offset 8
   */
  async fetchStreamsByPool(pool: PublicKey): Promise<StreamWithAddress[]> {
    const connection = this.provider.connection;

    // Stream discriminator from Anchor (SHA256("account:Stream")[0..8])
    const streamDiscriminator = Buffer.from([166, 224, 59, 4, 202, 10, 186, 83]);

    const accounts = await connection.getProgramAccounts(this.programId, {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: streamDiscriminator.toString("base64"),
            encoding: "base64",
          },
        },
        {
          memcmp: {
            offset: 8, // After discriminator
            bytes: pool.toBase58(),
          },
        },
      ],
    });

    const streams: StreamWithAddress[] = [];

    for (const { pubkey, account } of accounts) {
      try {
        const stream = (this.program.coder.accounts as any).decode(
          "stream",
          account.data
        ) as Stream;
        streams.push({ address: pubkey, stream });
      } catch {
        // Skip malformed accounts
      }
    }

    return streams;
  }

  /**
   * Calculate real-time aggregate statistics for a pool
   * Fetches all streams and calculates vesting off-chain
   */
  async getPoolAggregateStats(pool: PublicKey): Promise<PoolAggregateStats> {
    const streams = await this.fetchStreamsByPool(pool);
    const currentTime = Math.floor(Date.now() / 1000);

    let totalDeposited = new BN(0);
    let totalVested = new BN(0);
    let totalWithdrawn = new BN(0);
    let activeStreams = 0;
    let expiredStreams = 0;

    for (const { stream } of streams) {
      const vesting = calculateStreamVesting(stream, currentTime);

      totalDeposited = totalDeposited.add(vesting.totalDeposited);
      totalVested = totalVested.add(vesting.totalVested);
      totalWithdrawn = totalWithdrawn.add(stream.totalWithdrawn);

      if (vesting.isExpired) {
        expiredStreams++;
      } else {
        activeStreams++;
      }
    }

    const totalClaimable = totalVested.sub(totalWithdrawn);
    const totalUnvested = totalDeposited.sub(totalVested);

    return {
      pool,
      totalStreams: streams.length,
      activeStreams,
      expiredStreams,
      totalDeposited,
      totalVested,
      totalWithdrawn,
      totalClaimable: totalClaimable.gtn(0) ? totalClaimable : new BN(0),
      totalUnvested,
      calculatedAt: new Date(),
    };
  }

  /**
   * Get real-time claimable amount for a stream (calculated off-chain)
   */
  async getRealTimeClaimable(streamAddress: PublicKey): Promise<BN> {
    const stream = await this.fetchStream(streamAddress);
    if (!stream) return new BN(0);

    const vesting = calculateStreamVesting(stream);
    return vesting.claimable;
  }

  /**
   * Get detailed stream info with real-time vesting calculation
   */
  async getStreamInfoRealTime(streamAddress: PublicKey): Promise<StreamInfo | null> {
    const stream = await this.fetchStream(streamAddress);
    if (!stream) return null;

    const currentTime = Math.floor(Date.now() / 1000);
    const vesting = calculateStreamVesting(stream, currentTime);

    const segments: SegmentInfo[] = stream.segments.map((seg, index) => {
      const segVested = vesting.totalVested; // Simplified - could calculate per-segment
      return {
        index,
        tier: seg.tier,
        payer: seg.payer,
        amount: seg.amount,
        vested: seg.vested,
        unvested: seg.amount.sub(seg.vested),
        ratePerSecond: seg.ratePerSecond,
        cancelled: seg.cancelled,
        isComplete: seg.vested.eq(seg.amount) || seg.cancelled,
      };
    });

    return {
      address: streamAddress,
      pool: stream.pool,
      subscriber: stream.subscriber,
      startTime: new Date(stream.startTime.toNumber() * 1000),
      totalDeposited: vesting.totalDeposited,
      totalVested: vesting.totalVested,
      totalWithdrawn: stream.totalWithdrawn,
      claimable: vesting.claimable,
      activeSegments: segments.filter((s) => !s.isComplete).length,
      cancelledSegments: segments.filter((s) => s.cancelled).length,
      isExpired: vesting.isExpired,
      segments,
    };
  }
}
