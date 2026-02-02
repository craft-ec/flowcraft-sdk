// Main client
export { FlowcraftClient, IDL } from "./client";

// Types
export {
  Config,
  Pool,
  Pass,
  Segment,
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

// Constants
export {
  PROGRAM_ID,
  RATE_DECIMALS,
  BPS_DENOMINATOR,
  MAX_FEE_BPS,
  MAX_SEGMENTS,
  CONFIG_SEED,
  POOL_SEED,
  PASS_SEED,
  VAULT_SEED,
} from "./constants";

// Utilities
export {
  getConfigPda,
  getPoolPda,
  getPassPda,
  getVaultPda,
  calculateFee,
  calculateNetAmount,
  calculateRate,
  calculateRemainingDuration,
  calculateChangeCost,
  calculateSegmentVested,
  calculatePassVesting,
  bnToNumber,
  numberToBn,
  formatTokenAmount,
  toBN,
} from "./utils";
