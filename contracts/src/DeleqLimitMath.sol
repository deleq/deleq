// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title DeleqLimitMath
/// @notice Reason bits and limit arithmetic shared by DeleqMandateGuard and its tests. The site's TypeScript engine
///         (src/lib/mandate/bits.ts) uses the same bit positions; a unit test reads this file to keep them in step.
/// @dev Days are calendar UTC days: day = timestamp / 86400. A daily cap resets at 00:00 UTC, not 24 h after the
///      first spend. This is the simplest rule to explain and to check by hand; it does allow up to 2x the cap
///      across a midnight boundary, which the site states next to the cap.
library DeleqLimitMath {
    // ---- reason bits returned by check views and carried by the Rejected error -------------------------------
    uint256 internal constant R_UNKNOWN_MANDATE = 1 << 0;
    uint256 internal constant R_REVOKED = 1 << 1;
    uint256 internal constant R_PAUSED = 1 << 2;
    uint256 internal constant R_NOT_STARTED = 1 << 3;
    uint256 internal constant R_EXPIRED = 1 << 4;
    uint256 internal constant R_NOT_AGENT = 1 << 5;
    uint256 internal constant R_ZERO_AMOUNT = 1 << 6;
    uint256 internal constant R_TOKEN_NOT_ALLOWED = 1 << 7;
    uint256 internal constant R_RECIPIENT_NOT_ALLOWED = 1 << 8;
    uint256 internal constant R_OVER_PER_TX = 1 << 9;
    uint256 internal constant R_OVER_DAILY = 1 << 10;
    uint256 internal constant R_DAILY_COUNT = 1 << 11;
    uint256 internal constant R_ROUTER_NOT_ALLOWED = 1 << 12;
    uint256 internal constant R_TOKEN_OUT_NOT_ALLOWED = 1 << 13;
    uint256 internal constant R_LOW_ALLOWANCE = 1 << 14;
    uint256 internal constant R_LOW_BALANCE = 1 << 15;
    uint256 internal constant R_NO_MIN_OUT = 1 << 16;
    uint256 internal constant R_SAME_TOKEN = 1 << 17;
    uint256 internal constant R_TOKEN_UNREADABLE = 1 << 18;

    /// @notice Highest bit in use; bits above it are always zero.
    uint256 internal constant R_LAST = R_TOKEN_UNREADABLE;

    uint256 internal constant DAY = 1 days;

    /// @notice Calendar UTC day number of a timestamp.
    function dayOf(uint256 ts) internal pure returns (uint64) {
        return uint64(ts / DAY);
    }

    /// @notice What has been spent on `today`, given the stored (day, spent) pair. A stale day reads as zero.
    function spentOn(uint64 storedDay, uint256 storedSpent, uint64 today) internal pure returns (uint256) {
        return storedDay == today ? storedSpent : 0;
    }

    /// @notice Bits for the amount limits of one token: zero amount, per-transaction cap and daily cap.
    /// @dev `spent + amount` cannot overflow: caps are uint128 and spent never exceeds a cap.
    function amountBits(uint256 amount, uint256 perTxCap, uint256 dailyCap, uint256 spentToday)
        internal
        pure
        returns (uint256 bits)
    {
        if (amount == 0) return R_ZERO_AMOUNT;
        if (amount > perTxCap) bits |= R_OVER_PER_TX;
        if (amount > dailyCap || spentToday + amount > dailyCap) bits |= R_OVER_DAILY;
    }

    /// @notice Bits for the mandate's time window and state.
    function stateBits(bool exists, bool revoked, bool paused, uint64 validFrom, uint64 expiry, uint256 nowTs)
        internal
        pure
        returns (uint256 bits)
    {
        if (!exists) return R_UNKNOWN_MANDATE;
        if (revoked) bits |= R_REVOKED;
        if (paused) bits |= R_PAUSED;
        if (nowTs < validFrom) bits |= R_NOT_STARTED;
        if (nowTs >= expiry) bits |= R_EXPIRED;
    }

    /// @notice Bit for the per-day action count. `maxPerDay == 0` means no count limit.
    function countBits(uint32 maxPerDay, uint64 storedDay, uint32 storedCount, uint64 today)
        internal
        pure
        returns (uint256)
    {
        if (maxPerDay == 0) return 0;
        uint32 used = storedDay == today ? storedCount : 0;
        return used >= maxPerDay ? R_DAILY_COUNT : 0;
    }

    /// @notice Remaining daily allowance for a token (0 when spent reached the cap).
    function remaining(uint256 dailyCap, uint256 spentToday) internal pure returns (uint256) {
        return spentToday >= dailyCap ? 0 : dailyCap - spentToday;
    }
}
