use anchor_lang::prelude::*;

#[error_code]
pub enum TmbError {
    #[msg("The game is paused.")]
    Paused,
    #[msg("Invalid spin amount.")]
    InvalidSpinAmount,
    #[msg("Not enough bags, bro. Top up your TMB.")]
    NotEnoughBags,
    #[msg("This Bro has been burned.")]
    BroBurned,
    #[msg("Bro is not in escrow.")]
    NotInEscrow,
    #[msg("A spin is already pending for this Bro.")]
    SpinPending,
    #[msg("No spin is pending for this Bro.")]
    NoSpinPending,
    #[msg("Signer does not own this Bro.")]
    NotOwner,
    #[msg("Randomness has not been revealed yet.")]
    RandomnessNotReady,
    #[msg("Randomness was already revealed at request time.")]
    RandomnessAlreadyRevealed,
    #[msg("Randomness account is stale, foreign or malformed.")]
    StaleRandomness,
    #[msg("Prize table is invalid.")]
    PrizeTableInvalid,
    #[msg("Prize table must contain exactly one REKT wedge.")]
    MissingRektWedge,
    #[msg("Payout would breach the pool reserve.")]
    PoolReserveBreached,
    #[msg("Transfer cooldown is still active for this Bro.")]
    CooldownActive,
    #[msg("Invalid rescue fee.")]
    InvalidRescueFee,
    #[msg("You cannot rescue your own Bro.")]
    SelfRescue,
    #[msg("This Bro is not in the graveyard.")]
    NotBurned,
    #[msg("Arithmetic overflow.")]
    Overflow,
    #[msg("Unauthorized.")]
    Unauthorized,
    #[msg("Max supply reached.")]
    MaxSupply,
    #[msg("Spin is not stale yet.")]
    SpinNotStale,
    #[msg("Invalid configuration value.")]
    InvalidConfig,
    #[msg("Asset is not a Bro from this collection or is not owned correctly.")]
    InvalidAsset,
    #[msg("Collection already created.")]
    CollectionAlreadySet,
    #[msg("Collection not created yet.")]
    CollectionNotSet,
    #[msg("Holding index out of range.")]
    InvalidHolding,
    #[msg("Name or uri too long.")]
    StringTooLong,
    #[msg("Invalid vault token account.")]
    InvalidVaultAccount,
    #[msg("Invalid amount.")]
    InvalidAmount,
    #[msg("No pending authority proposal.")]
    NoPendingAuthority,
    #[msg("A required account (prize vault or bonus asset) was not supplied.")]
    MissingAccounts,
}
