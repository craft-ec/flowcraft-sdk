# @craftec/flowcraft-sdk

SDK for Flowcraft subscription streaming protocol on Solana.

## Installation

```bash
npm install @craftec/flowcraft-sdk
```

## Protocol Overview

Flowcraft is a subscription streaming protocol where payments vest linearly over time.

### Core Concepts

```
Pool (Creator)
  └── Stream (per Subscriber)
        └── Segments (sequential vesting periods)
```

- **Pool**: Created by content creators. Subscribers pay into the pool's vault.
- **Stream**: One per subscriber per pool. Tracks subscriber's payment history.
- **Segment**: A vesting period with amount, duration, and rate. Segments vest sequentially.

### Vesting Model

Segments vest **sequentially**, not in parallel:

```
Segment 0: $100 over 30 days  [vesting...]
Segment 1: $50 over 15 days   [queued]
Segment 2: $200 over 60 days  [queued]

Timeline: [--- Seg 0 (30d) ---][- Seg 1 (15d) -][------ Seg 2 (60d) ------]
```

Each segment has:
- `amount`: Total tokens to vest
- `ratePerSecond`: Vesting rate (amount * RATE_DECIMALS / duration)
- `vested`: Already vested amount (updated on-chain periodically)
- `cancelled`: Whether segment was cancelled (unvested refunded)

### Account Structure (PDAs)

```typescript
// Config (global, one per program)
seeds = ["config"]

// Pool
seeds = ["pool", owner.pubkey, pool_name]

// Vault (token account owned by pool)
seeds = ["vault", pool.pubkey]

// Stream
seeds = ["stream", pool.pubkey, subscriber.pubkey]
```

## Quick Start

```typescript
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Wallet } from "@coral-xyz/anchor";
import { FlowcraftClient } from "@craftec/flowcraft-sdk";

// Initialize client
const connection = new Connection("https://api.devnet.solana.com");
const wallet = new Wallet(yourKeypair);
const client = new FlowcraftClient(connection, wallet);

// Create a pool
const { signature, pool, vault } = await client.createPool(payer, owner, {
  name: "premium",
  mint: mintPubkey,
});

// Subscribe to a pool (creates stream + first segment)
const { signature, stream, segmentIndex } = await client.subscribe(subscriber, {
  pool: poolPubkey,
  tier: "monthly",
  amount: 100_000_000, // in smallest units
  durationSeconds: 30 * 24 * 60 * 60, // 30 days
  subscriberTokenAccount,
  treasuryTokenAccount,
});

// Add another segment to existing stream
const { signature, segmentIndex } = await client.addSegment(payer, {
  pool: poolPubkey,
  stream: streamPubkey,
  tier: "monthly",
  amount: 100_000_000,
  durationSeconds: 30 * 24 * 60 * 60,
  payerTokenAccount,
  treasuryTokenAccount,
});

// Calculate real-time vested amount (off-chain)
const stats = await client.getPoolAggregateStats(poolPubkey);
console.log("Total Vested:", stats.totalVested.toString());
console.log("Claimable:", stats.totalClaimable.toString());

// Batch claim from multiple streams
const { transactions, totalStreams } = await client.buildClaimAllTransactions(
  owner.publicKey,
  poolPubkey,
  ownerTokenAccount,
  20 // batch size
);

// Sign and send
const signed = await wallet.signAllTransactions(transactions);
await Promise.all(signed.map(tx => connection.sendTransaction(tx)));
```

## API Reference

### FlowcraftClient

Main client class for interacting with the Flowcraft protocol.

#### Constructor

```typescript
const client = new FlowcraftClient(
  connection: Connection,
  wallet: Wallet,
  programId?: PublicKey,  // defaults to PROGRAM_ID
  idl?: Idl               // defaults to bundled IDL
);
```

#### Pool Operations

| Method | Description |
|--------|-------------|
| `createPool(payer, owner, params)` | Create a new subscription pool |
| `fetchPool(pool)` | Fetch raw pool account data |
| `getPoolInfo(pool)` | Get pool with computed info |
| `getPoolAggregateStats(pool)` | Get aggregate vesting stats for all streams |
| `fetchStreamsByPool(pool)` | Fetch all streams for a pool |

#### Subscription Operations

| Method | Description |
|--------|-------------|
| `subscribe(subscriber, params)` | Subscribe to a pool (creates stream if new) |
| `addSegment(payer, params)` | Add a new segment to existing stream |
| `upgradeSegment(caller, params)` | Upgrade/downgrade a segment's rate |
| `cancelSegment(subscriber, params)` | Cancel a segment (refunds unvested) |

#### Claiming

| Method | Description |
|--------|-------------|
| `claim(owner, params)` | Claim vested tokens from single stream |
| `claimBatch(owner, params)` | Claim from multiple streams in one tx |
| `buildClaimAllTransactions(...)` | Build batch claim txs for all pool streams |

#### Stream Queries

| Method | Description |
|--------|-------------|
| `fetchStream(stream)` | Fetch raw stream account data |
| `getStreamInfo(stream)` | Get stream with on-chain vested values |
| `getStreamInfoRealTime(stream)` | Get stream with real-time vesting calculation |
| `getRealTimeClaimable(stream)` | Get current claimable amount |

### PDA Helpers

Derive program addresses:

```typescript
import { getConfigPda, getPoolPda, getVaultPda, getStreamPda } from "@craftec/flowcraft-sdk";

// Config PDA (global)
const [configPda, configBump] = getConfigPda(programId);

// Pool PDA
const [poolPda, poolBump] = getPoolPda(ownerPubkey, "pool-name", programId);

// Vault PDA (token account)
const [vaultPda, vaultBump] = getVaultPda(poolPubkey, programId);

// Stream PDA
const [streamPda, streamBump] = getStreamPda(poolPubkey, subscriberPubkey, programId);
```

### Vesting Utilities

Calculate vesting off-chain (real-time, without on-chain calls):

```typescript
import { calculateStreamVesting, calculateSegmentVested } from "@craftec/flowcraft-sdk";

// Calculate entire stream's vesting state
const stream = await client.fetchStream(streamPubkey);
const vesting = calculateStreamVesting(stream);
console.log("Total Deposited:", vesting.totalDeposited.toString());
console.log("Total Vested:", vesting.totalVested.toString());
console.log("Claimable:", vesting.claimable.toString());
console.log("Is Expired:", vesting.isExpired);

// Calculate single segment's vested amount
const segmentVested = calculateSegmentVested(
  segment,           // { amount, vested, ratePerSecond, cancelled }
  lastUpdateTime,    // BN - stream.lastUpdateTime
  currentTime        // number - current unix timestamp
);
```

### Upgrade/Downgrade

Tier changes are **cost-based**, not name-based. The protocol only cares about the price difference:

```typescript
// Upgrade: new_cost > unvested (user pays difference)
// Downgrade: new_cost < unvested (user gets refund)

await client.upgradeSegment(caller, {
  pool: poolPubkey,
  stream: streamPubkey,
  subscriber: subscriberPubkey,
  segmentIndex: 0,
  newAmount: 200_000_000,        // new total for remaining duration
  newDuration: 30 * 24 * 60 * 60,
  callerTokenAccount,            // pays if upgrade
  payerTokenAccount,             // receives refund if downgrade
});
```

**Note:** Only the subscriber can downgrade (receive refund). Anyone can upgrade (pay more).

### Cancellation

Cancel a segment to stop vesting and refund unvested tokens:

```typescript
await client.cancelSegment(subscriber, {
  pool: poolPubkey,
  stream: streamPubkey,
  segmentIndex: 0,
  refundTokenAccount,  // receives unvested tokens
});
```

- Vested amount stays claimable by pool owner
- Unvested amount refunded to original segment payer
- Cancelled segments are skipped in vesting calculation

## Constants

```typescript
import { PROGRAM_ID, RATE_DECIMALS, MAX_SEGMENTS } from "@craftec/flowcraft-sdk";

// Program ID (devnet/mainnet)
console.log(PROGRAM_ID.toBase58());
// 3T8z77gRqyW6KZQBHf1ah2uKABh9vc5rSTaD595U2wm9

// Rate decimals for vesting calculation (10^9)
console.log(RATE_DECIMALS);
// 1000000000n

// Maximum segments per stream
console.log(MAX_SEGMENTS);
// 100
```

## Types

```typescript
import type {
  Pool,
  Stream,
  Segment,
  StreamInfo,
  SegmentInfo,
  PoolInfo,
  PoolAggregateStats,
  CreatePoolParams,
  SubscribeParams,
  AddSegmentParams,
  UpgradeSegmentParams,
  CancelSegmentParams,
  ClaimParams,
} from "@craftec/flowcraft-sdk";
```

## Browser/Mobile Usage

The SDK uses `Keypair` for signing which works in Node.js. For browser/mobile, use the IDL directly with your wallet adapter:

```typescript
import { Program } from "@coral-xyz/anchor";
import { IDL, PROGRAM_ID } from "@craftec/flowcraft-sdk";

// Create program with your wallet adapter's provider
const program = new Program(IDL, PROGRAM_ID, provider);

// Build transaction
const tx = await program.methods
  .subscribe(tier, amount, duration)
  .accounts({
    subscriber: wallet.publicKey,
    pool: poolPubkey,
    // ... other accounts
  })
  .transaction();

// Sign with wallet adapter
await walletAdapter.signAndSendTransaction(tx);
```

Use SDK utilities for PDA derivation and vesting calculations - they work everywhere.

## License

MIT
