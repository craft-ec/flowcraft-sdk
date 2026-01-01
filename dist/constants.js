"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VAULT_SEED = exports.STREAM_SEED = exports.POOL_SEED = exports.CONFIG_SEED = exports.MAX_SEGMENTS = exports.MAX_FEE_BPS = exports.BPS_DENOMINATOR = exports.RATE_DECIMALS = exports.PROGRAM_ID = void 0;
const web3_js_1 = require("@solana/web3.js");
exports.PROGRAM_ID = new web3_js_1.PublicKey("3T8z77gRqyW6KZQBHf1ah2uKABh9vc5rSTaD595U2wm9");
exports.RATE_DECIMALS = 1000000000n;
exports.BPS_DENOMINATOR = 10000n;
exports.MAX_FEE_BPS = 1000n; // 10%
exports.MAX_SEGMENTS = 100;
// Seeds for PDA derivation
exports.CONFIG_SEED = "config";
exports.POOL_SEED = "pool";
exports.STREAM_SEED = "stream";
exports.VAULT_SEED = "vault";
//# sourceMappingURL=constants.js.map