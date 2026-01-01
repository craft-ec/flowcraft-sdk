# @craftec/flowcraft-sdk

SDK for Flowcraft subscription streaming protocol on Solana.

## Installation

```bash
npm install @craftec/flowcraft-sdk
```

## Usage

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

// Subscribe to a pool
const { signature, stream } = await client.subscribe(subscriber, {
  pool: poolPubkey,
  tier: "monthly",
  amount: 100_000_000, // in smallest units
  durationSeconds: 30 * 24 * 60 * 60, // 30 days
  subscriberTokenAccount,
  treasuryTokenAccount,
});

// Calculate vested amount (off-chain)
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

// Sign all transactions at once
const signed = await wallet.signAllTransactions(transactions);

// Send in parallel
await Promise.all(signed.map(tx => connection.sendTransaction(tx)));
```

## API Reference

### FlowcraftClient

Main client class for interacting with the Flowcraft protocol.

#### Pool Operations
- `createPool(payer, owner, params)` - Create a new subscription pool
- `fetchPool(pool)` - Fetch pool data
- `getPoolInfo(pool)` - Get pool with computed info
- `getPoolAggregateStats(pool)` - Get aggregate vesting stats for all streams

#### Subscription Operations
- `subscribe(subscriber, params)` - Subscribe to a pool
- `addSegment(payer, params)` - Add a new segment to existing subscription
- `upgradeSegment(subscriber, params)` - Upgrade/downgrade a segment
- `cancelSegment(subscriber, params)` - Cancel a segment

#### Claiming
- `claim(owner, params)` - Claim from single stream
- `claimBatch(owner, params)` - Claim from multiple streams in one tx
- `buildClaimAllTransactions(...)` - Build batch claim txs for all streams

#### Utilities
- `getStreamInfoRealTime(stream)` - Get stream with real-time vesting calculation
- `getRealTimeClaimable(stream)` - Get current claimable amount

## Constants

```typescript
import { PROGRAM_ID, RATE_DECIMALS } from "@craftec/flowcraft-sdk";

// Program ID (devnet/mainnet)
console.log(PROGRAM_ID.toBase58());

// Rate decimals for vesting calculation (10^9)
console.log(RATE_DECIMALS); // 1000000000
```

## License

MIT
