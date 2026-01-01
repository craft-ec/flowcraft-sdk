"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfigPda = getConfigPda;
exports.getPoolPda = getPoolPda;
exports.getStreamPda = getStreamPda;
exports.getVaultPda = getVaultPda;
exports.calculateFee = calculateFee;
exports.calculateNetAmount = calculateNetAmount;
exports.calculateRate = calculateRate;
exports.calculateRemainingDuration = calculateRemainingDuration;
exports.calculateUpgradeCost = calculateUpgradeCost;
exports.bnToNumber = bnToNumber;
exports.numberToBn = numberToBn;
exports.formatTokenAmount = formatTokenAmount;
exports.toBN = toBN;
exports.calculateSegmentVested = calculateSegmentVested;
exports.calculateStreamVesting = calculateStreamVesting;
const web3_js_1 = require("@solana/web3.js");
const anchor_1 = require("@coral-xyz/anchor");
const constants_1 = require("./constants");
/**
 * Derive the config PDA
 */
function getConfigPda(programId = constants_1.PROGRAM_ID) {
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from(constants_1.CONFIG_SEED)], programId);
}
/**
 * Derive the pool PDA for an owner and pool name
 */
function getPoolPda(owner, name, programId = constants_1.PROGRAM_ID) {
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from(constants_1.POOL_SEED), owner.toBuffer(), Buffer.from(name)], programId);
}
/**
 * Derive the stream PDA for a pool and subscriber
 */
function getStreamPda(pool, subscriber, programId = constants_1.PROGRAM_ID) {
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from(constants_1.STREAM_SEED), pool.toBuffer(), subscriber.toBuffer()], programId);
}
/**
 * Derive the vault PDA for a pool
 */
function getVaultPda(pool, programId = constants_1.PROGRAM_ID) {
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from(constants_1.VAULT_SEED), pool.toBuffer()], programId);
}
/**
 * Calculate fee amount from gross amount
 */
function calculateFee(amount, feeBps) {
    return amount.mul(feeBps).div(new anchor_1.BN(constants_1.BPS_DENOMINATOR.toString()));
}
/**
 * Calculate net amount after fee deduction
 */
function calculateNetAmount(amount, feeBps) {
    const fee = calculateFee(amount, feeBps);
    return amount.sub(fee);
}
/**
 * Calculate rate per second from amount and duration
 */
function calculateRate(amount, durationSeconds) {
    return amount
        .mul(new anchor_1.BN(constants_1.RATE_DECIMALS.toString()))
        .div(durationSeconds);
}
/**
 * Calculate remaining duration from unvested amount and rate
 */
function calculateRemainingDuration(unvested, ratePerSecond) {
    return unvested
        .mul(new anchor_1.BN(constants_1.RATE_DECIMALS.toString()))
        .div(ratePerSecond);
}
/**
 * Calculate new cost at a different rate for remaining duration
 */
function calculateUpgradeCost(unvested, currentRate, newRate) {
    const remainingDuration = calculateRemainingDuration(unvested, currentRate);
    const newCost = remainingDuration
        .mul(newRate)
        .div(new anchor_1.BN(constants_1.RATE_DECIMALS.toString()));
    const isUpgrade = newCost.gt(unvested);
    const difference = isUpgrade
        ? newCost.sub(unvested)
        : unvested.sub(newCost);
    return { newCost, difference, isUpgrade };
}
/**
 * Convert BN to number (for display purposes)
 */
function bnToNumber(bn, decimals = 0) {
    if (decimals === 0)
        return bn.toNumber();
    return bn.toNumber() / Math.pow(10, decimals);
}
/**
 * Convert number to BN with decimals
 */
function numberToBn(num, decimals = 0) {
    return new anchor_1.BN(Math.floor(num * Math.pow(10, decimals)));
}
/**
 * Format token amount with decimals
 */
function formatTokenAmount(amount, decimals) {
    const str = amount.toString().padStart(decimals + 1, "0");
    const intPart = str.slice(0, -decimals) || "0";
    const decPart = str.slice(-decimals);
    return `${intPart}.${decPart}`;
}
/**
 * Ensure value is BN
 */
function toBN(value) {
    return typeof value === "number" ? new anchor_1.BN(value) : value;
}
/**
 * Calculate real-time vested amount for a segment based on current time
 */
function calculateSegmentVested(segment, lastUpdateTime, currentTime) {
    if (segment.cancelled) {
        return segment.vested;
    }
    const elapsed = new anchor_1.BN(currentTime).sub(lastUpdateTime);
    if (elapsed.lten(0)) {
        return segment.vested;
    }
    const additionalVested = elapsed
        .mul(segment.ratePerSecond)
        .div(new anchor_1.BN(constants_1.RATE_DECIMALS.toString()));
    const unvested = segment.amount.sub(segment.vested);
    const newVested = anchor_1.BN.min(additionalVested, unvested);
    return segment.vested.add(newVested);
}
/**
 * Calculate real-time vesting for an entire stream
 * Returns { totalVested, totalUnvested, claimable, isExpired }
 */
function calculateStreamVesting(stream, currentTime = Math.floor(Date.now() / 1000)) {
    let totalDeposited = stream.archivedAmount;
    let totalVested = stream.archivedVested;
    let remainingTime = new anchor_1.BN(currentTime).sub(stream.lastUpdateTime);
    let allComplete = true;
    for (const segment of stream.segments) {
        totalDeposited = totalDeposited.add(segment.amount);
        if (segment.cancelled) {
            totalVested = totalVested.add(segment.vested);
            continue;
        }
        const unvested = segment.amount.sub(segment.vested);
        if (unvested.gtn(0)) {
            // Calculate how much time this segment needs
            const timeNeeded = unvested
                .mul(new anchor_1.BN(constants_1.RATE_DECIMALS.toString()))
                .div(segment.ratePerSecond);
            if (remainingTime.gte(timeNeeded)) {
                // Segment fully vests
                totalVested = totalVested.add(segment.amount);
                remainingTime = remainingTime.sub(timeNeeded);
            }
            else {
                // Partial vesting
                const additionalVested = remainingTime
                    .mul(segment.ratePerSecond)
                    .div(new anchor_1.BN(constants_1.RATE_DECIMALS.toString()));
                totalVested = totalVested.add(segment.vested).add(additionalVested);
                remainingTime = new anchor_1.BN(0);
                allComplete = false;
            }
        }
        else {
            totalVested = totalVested.add(segment.vested);
        }
    }
    const totalUnvested = totalDeposited.sub(totalVested);
    const claimable = totalVested.sub(stream.totalWithdrawn);
    return {
        totalDeposited,
        totalVested,
        totalUnvested,
        claimable: claimable.gtn(0) ? claimable : new anchor_1.BN(0),
        isExpired: allComplete && totalUnvested.eqn(0),
    };
}
//# sourceMappingURL=utils.js.map