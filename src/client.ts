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
  Pass,
  PoolInfo,
  PassInfo,
  SegmentInfo,
  PoolAggregateStats,
  PassWithAddress,
  CreatePoolParams,
  CreatePassParams,
  AddSegmentParams,
  ClaimParams,
  CancelSegmentParams,
  ChangeSegmentParams,
} from "./types";
import {
  getConfigPda,
  getPoolPda,
  getPassPda,
  getVaultPda,
  toBN,
  calculatePassVesting,
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
   * Get the pass PDA for a pool and holder
   */
  getPassPda(pool: PublicKey, holder: PublicKey): [PublicKey, number] {
    return getPassPda(pool, holder, this.programId);
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
   * Fetch a pass by address
   */
  async fetchPass(pass: PublicKey): Promise<Pass | null> {
    try {
      const account = await (this.program.account as any).pass.fetch(pass);
      return account as Pass;
    } catch {
      return null;
    }
  }

  /**
   * Fetch a pass by pool and holder
   */
  async fetchPassByHolder(
    pool: PublicKey,
    holder: PublicKey
  ): Promise<Pass | null> {
    const [passPda] = this.getPassPda(pool, holder);
    return this.fetchPass(passPda);
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
      totalPasses: poolData.totalPasses.toNumber(),
      totalDeposited: poolData.totalDeposited,
      totalWithdrawn: poolData.totalWithdrawn,
      totalRefunded: poolData.totalRefunded,
      createdAt: new Date(poolData.createdAt.toNumber() * 1000),
    };
  }

  /**
   * Fetch pass with computed info
   */
  async getPassInfo(pass: PublicKey): Promise<PassInfo | null> {
    const passData = await this.fetchPass(pass);
    if (!passData) return null;

    let totalDeposited = passData.archivedAmount;
    let totalVested = passData.archivedVested;
    let activeSegments = 0;
    let cancelledSegments = 0;

    const segments: SegmentInfo[] = passData.segments.map((seg, index) => {
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

    const claimable = totalVested.sub(passData.totalWithdrawn);
    const isExpired = passData.segments.every(
      (s) => s.vested.eq(s.amount) || s.cancelled
    );

    return {
      address: pass,
      pool: passData.pool,
      holder: passData.holder,
      startTime: new Date(passData.startTime.toNumber() * 1000),
      totalDeposited,
      totalVested,
      totalWithdrawn: passData.totalWithdrawn,
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
   * Create a new pool
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
  // Pass Instructions
  // ============================================================================

  /**
   * Create a pass (creates pass with first segment)
   * For new passes, segmentIndex is 0. For reactivated expired passes, segments are cleared so index is also 0.
   */
  async createPass(
    holder: Keypair,
    params: CreatePassParams
  ): Promise<{ signature: string; pass: PublicKey; segmentIndex: number }> {
    const [configPda] = this.getConfigPda();
    const [passPda] = this.getPassPda(params.pool, holder.publicKey);
    const [vaultPda] = this.getVaultPda(params.pool);

    // Check if pass exists and get current segment count
    let segmentIndex = 0;
    try {
      const existingPass = await this.fetchPass(passPda);
      if (existingPass) {
        // Check if pass is expired (all segments fully vested or cancelled)
        const isExpired = existingPass.segments.every(
          (s) => s.vested.eq(s.amount) || s.cancelled
        );
        // If expired, segments will be cleared; otherwise add to existing
        segmentIndex = isExpired ? 0 : existingPass.segments.length;
      }
    } catch {
      // New pass - segment index is 0
    }

    const signature = await this.program.methods
      .createPass(params.tier, toBN(params.amount), toBN(params.durationSeconds))
      .accounts({
        holder: holder.publicKey,
        pool: params.pool,
        config: configPda,
        pass: passPda,
        vault: vaultPda,
        holderTokenAccount: params.holderTokenAccount,
        treasuryTokenAccount: params.treasuryTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([holder])
      .rpc();

    return { signature, pass: passPda, segmentIndex };
  }

  /**
   * Add a new segment to an existing pass
   */
  async addSegment(
    payer: Keypair,
    params: AddSegmentParams
  ): Promise<{ signature: string; segmentIndex: number }> {
    const [configPda] = this.getConfigPda();
    const [vaultPda] = this.getVaultPda(params.pool);

    // Fetch pass to get current segment count
    const pass = await this.fetchPass(params.pass);
    if (!pass) {
      throw new Error("Pass not found");
    }
    const segmentIndex = pass.segments.length;

    const signature = await this.program.methods
      .addSegment(params.tier, toBN(params.amount), toBN(params.durationSeconds))
      .accounts({
        payer: payer.publicKey,
        pool: params.pool,
        config: configPda,
        pass: params.pass,
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
        pass: params.pass,
        vault: vaultPda,
        ownerTokenAccount: params.ownerTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([owner])
      .rpc();
  }

  /**
   * Claim vested tokens from multiple passes in a single transaction
   */
  async claimBatch(
    owner: Keypair,
    params: {
      pool: PublicKey;
      passes: PublicKey[];
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
        params.passes.map((pass) => ({
          pubkey: pass,
          isSigner: false,
          isWritable: true,
        }))
      )
      .signers([owner])
      .rpc();
  }

  /**
   * Build batch claim transactions for all passes in a pool
   * Returns transactions ready to be signed with signAllTransactions
   */
  async buildClaimAllTransactions(
    owner: PublicKey,
    pool: PublicKey,
    ownerTokenAccount: PublicKey,
    batchSize: number = 20
  ): Promise<{ transactions: any[]; totalPasses: number }> {
    // Fetch all passes for this pool
    const passes = await this.fetchPassesByPool(pool);
    const passAddresses = passes.map((p: PassWithAddress) => p.address);

    const [vaultPda] = this.getVaultPda(pool);
    const transactions: any[] = [];

    // Split into batches
    for (let i = 0; i < passAddresses.length; i += batchSize) {
      const batch = passAddresses.slice(i, i + batchSize);

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

    return { transactions, totalPasses: passAddresses.length };
  }

  /**
   * Cancel a segment (holder only)
   */
  async cancelSegment(
    holder: Keypair,
    params: CancelSegmentParams
  ): Promise<string> {
    const [vaultPda] = this.getVaultPda(params.pool);

    return await this.program.methods
      .cancelSegment(params.segmentIndex)
      .accounts({
        holder: holder.publicKey,
        pool: params.pool,
        pass: params.pass,
        vault: vaultPda,
        refundTokenAccount: params.refundTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([holder])
      .rpc();
  }

  /**
   * Change segment tier (upgrade or downgrade)
   */
  async changeSegment(
    caller: Keypair,
    params: ChangeSegmentParams
  ): Promise<string> {
    const [configPda] = this.getConfigPda();
    const [vaultPda] = this.getVaultPda(params.pool);

    return await this.program.methods
      .changeSegment(
        params.segmentIndex,
        params.newTier,
        toBN(params.newAmount),
        toBN(params.newDuration)
      )
      .accounts({
        caller: caller.publicKey,
        holder: params.holder,
        config: configPda,
        pool: params.pool,
        pass: params.pass,
        vault: vaultPda,
        callerTokenAccount: params.callerTokenAccount,
        payerTokenAccount: params.payerTokenAccount,
        treasuryTokenAccount: params.treasuryTokenAccount,
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
   * Check if a pass exists
   */
  async passExists(pool: PublicKey, holder: PublicKey): Promise<boolean> {
    const pass = await this.fetchPassByHolder(pool, holder);
    return pass !== null;
  }

  /**
   * Get claimable amount for a pass
   */
  async getClaimable(pass: PublicKey): Promise<BN> {
    const info = await this.getPassInfo(pass);
    return info?.claimable ?? new BN(0);
  }

  /**
   * Check if pass is expired
   */
  async isPassExpired(pass: PublicKey): Promise<boolean> {
    const info = await this.getPassInfo(pass);
    return info?.isExpired ?? true;
  }

  // ============================================================================
  // Pool Analytics (Off-chain Calculation)
  // ============================================================================

  /**
   * Fetch all passes for a pool using getProgramAccounts
   * Pass account layout: [8 discriminator][32 pool][32 holder]...
   * Filter by pool pubkey at offset 8
   */
  async fetchPassesByPool(pool: PublicKey): Promise<PassWithAddress[]> {
    const connection = this.provider.connection;

    // Pass discriminator from Anchor (SHA256("account:Pass")[0..8])
    const passDiscriminator = Buffer.from([40, 247, 140, 113, 56, 14, 57, 44]);

    const accounts = await connection.getProgramAccounts(this.programId, {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: passDiscriminator.toString("base64"),
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

    const passes: PassWithAddress[] = [];

    for (const { pubkey, account } of accounts) {
      try {
        const pass = (this.program.coder.accounts as any).decode(
          "pass",
          account.data
        ) as Pass;
        passes.push({ address: pubkey, pass });
      } catch {
        // Skip malformed accounts
      }
    }

    return passes;
  }

  /**
   * Calculate real-time aggregate statistics for a pool
   * Fetches all passes and calculates vesting off-chain
   */
  async getPoolAggregateStats(pool: PublicKey): Promise<PoolAggregateStats> {
    const passes = await this.fetchPassesByPool(pool);
    const currentTime = Math.floor(Date.now() / 1000);

    let totalDeposited = new BN(0);
    let totalVested = new BN(0);
    let totalWithdrawn = new BN(0);
    let activePasses = 0;
    let expiredPasses = 0;

    for (const { pass } of passes) {
      const vesting = calculatePassVesting(pass, currentTime);

      totalDeposited = totalDeposited.add(vesting.totalDeposited);
      totalVested = totalVested.add(vesting.totalVested);
      totalWithdrawn = totalWithdrawn.add(pass.totalWithdrawn);

      if (vesting.isExpired) {
        expiredPasses++;
      } else {
        activePasses++;
      }
    }

    const totalClaimable = totalVested.sub(totalWithdrawn);
    const totalUnvested = totalDeposited.sub(totalVested);

    return {
      pool,
      totalPasses: passes.length,
      activePasses,
      expiredPasses,
      totalDeposited,
      totalVested,
      totalWithdrawn,
      totalClaimable: totalClaimable.gtn(0) ? totalClaimable : new BN(0),
      totalUnvested,
      calculatedAt: new Date(),
    };
  }

  /**
   * Get real-time claimable amount for a pass (calculated off-chain)
   */
  async getRealTimeClaimable(passAddress: PublicKey): Promise<BN> {
    const pass = await this.fetchPass(passAddress);
    if (!pass) return new BN(0);

    const vesting = calculatePassVesting(pass);
    return vesting.claimable;
  }

  /**
   * Get detailed pass info with real-time vesting calculation
   */
  async getPassInfoRealTime(passAddress: PublicKey): Promise<PassInfo | null> {
    const pass = await this.fetchPass(passAddress);
    if (!pass) return null;

    const currentTime = Math.floor(Date.now() / 1000);
    const vesting = calculatePassVesting(pass, currentTime);

    const segments: SegmentInfo[] = pass.segments.map((seg, index) => {
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
      address: passAddress,
      pool: pass.pool,
      holder: pass.holder,
      startTime: new Date(pass.startTime.toNumber() * 1000),
      totalDeposited: vesting.totalDeposited,
      totalVested: vesting.totalVested,
      totalWithdrawn: pass.totalWithdrawn,
      claimable: vesting.claimable,
      activeSegments: segments.filter((s) => !s.isComplete).length,
      cancelledSegments: segments.filter((s) => s.cancelled).length,
      isExpired: vesting.isExpired,
      segments,
    };
  }
}
