// Main client
export { FlowcraftClient, IDL } from "./client";

// Types
export {
  Config,
  Pool,
  Stream,
  Segment,
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

// Constants
export {
  PROGRAM_ID,
  RATE_DECIMALS,
  BPS_DENOMINATOR,
  MAX_FEE_BPS,
  MAX_SEGMENTS,
  CONFIG_SEED,
  POOL_SEED,
  STREAM_SEED,
  VAULT_SEED,
} from "./constants";

// Utilities
export {
  getConfigPda,
  getPoolPda,
  getStreamPda,
  getVaultPda,
  calculateFee,
  calculateNetAmount,
  calculateRate,
  calculateRemainingDuration,
  calculateUpgradeCost,
  calculateSegmentVested,
  calculateStreamVesting,
  bnToNumber,
  numberToBn,
  formatTokenAmount,
  toBN,
} from "./utils";
