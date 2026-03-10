use nova::types::types::BASIS_POINTS;

// ─────────────────────────────────────────────────────────────────────────────
// NOVA MATH
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Yield Distribution Weight
//
// position weight = amount^1.5 * duration
// This is used ONLY for distributing yield for poitions
// Not tied to principal (nova_shares_value).
// ─────────────────────────────────────────────────────────────────────────────
pub fn calculate_position_weight_yield(amount: u256, duration_seconds: u64) -> u256 {
    let dur: u256 = duration_seconds.into();

    // amount^1.5 = amount * sqrt(amount)
    let amount_sqrt = _isqrt(amount);
    let amount_1_5 = amount * amount_sqrt;

    // weight = amount^1.5 * duration
    amount_1_5 * dur
}

/// Calculate how much nova shares to create and give the user for their position based on amount
/// deposited This calculation does not include yield gotten from early withdrawals or external
/// gates If the principal pool is empty and a user is cretaing a position give the position shares
/// worth 1:1 the deposit
pub fn calculate_nova_shares_to_create(
    amount_deposited: u256, total_principal: u256, total_shares: u256,
) -> u256 {
    if total_principal == 0 || total_shares == 0 {
        return amount_deposited;
    }

    let shares_to_create = (amount_deposited * total_shares) / total_principal;
    shares_to_create
}

/// Calculate nova_shares_value (principal value) from share count
/// nova_shares_value = (nova_shares / total_nova_shares) * (principal_pool)
/// This ensures fair NAV pricing
pub fn calculate_nova_shares_value(
    nova_shares: u256, total_nova_shares: u256, principal_pool: u256,
) -> u256 {
    if total_nova_shares == 0 || nova_shares == 0 {
        return 0;
    }
    (nova_shares * principal_pool) / total_nova_shares
}


// position_weight_value = position_weight / total_weight * total_yield
/// essentially gets the position weight value which is the share of yield that the users position
/// has based of their position weight assigned at amount^1.5 * duration
pub fn calculate_position_weight_value(
    position_weight: u256, total_weight: u256, total_yield: u256,
) -> u256 {
    if total_weight == 0 {
        return 0;
    }

    (position_weight * total_yield) / total_weight
}

// ─────────────────────────────────────────────────────────────────────────────
// EARLY EXIT PENALTY
//
// Linear penalty applied to PRINCIPAL (nova_shares_value) only, not yield.
//
// penalty = nova_shares_value * (remaining / total)
// user_receives = nova_shares_value - penalty
// penalty → total_yield_pool
// ─────────────────────────────────────────────────────────────────────────────
pub fn calculate_early_exit_penalty(
    nova_shares_value: u256, commitment_start: u64, commitment_end: u64, now: u64,
) -> u256 {
    if now >= commitment_end {
        return 0;
    }
    let total: u256 = (commitment_end - commitment_start).into();
    let remaining: u256 = (commitment_end - now).into();

    if total == 0 {
        return 0;
    }
    let remaining_ratio_bps = (remaining * BASIS_POINTS) / total;
    (nova_shares_value * remaining_ratio_bps) / BASIS_POINTS
}


// ─────────────────────────────────────────────────────────────────────────────
// Integer square root helper
// ─────────────────────────────────────────────────────────────────────────────
fn _isqrt(n: u256) -> u256 {
    if n <= 1 {
        return n;
    }

    let mut x = n;
    let mut y = (x + 1) / 2;

    while y < x {
        x = y;
        y = (x + n / x) / 2;
    }

    x
}

