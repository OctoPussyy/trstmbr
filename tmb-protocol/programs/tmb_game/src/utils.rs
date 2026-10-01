//! Shared helpers: Metaplex Core CPIs, Switchboard randomness parsing, PDA creation, burn flow.
use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_lang::AccountsClose;
use mpl_core::accounts::BaseAssetV1;
use mpl_core::instructions::{
    BurnV1CpiBuilder, CreateCollectionV2CpiBuilder, CreateV2CpiBuilder, TransferV1CpiBuilder,
};
use mpl_core::types::{DataState, UpdateAuthority};

use crate::constants::*;
use crate::errors::TmbError;
use crate::events::*;
use crate::state::*;

// ---------------------------------------------------------------------------------------------
// Metaplex Core
// ---------------------------------------------------------------------------------------------

pub struct CoreAsset {
    pub owner: Pubkey,
    pub name: String,
    pub uri: String,
}

/// Reads a Core asset and verifies it belongs to `collection` (so fake NFTs are rejected).
pub fn read_bro_asset(asset: &AccountInfo, collection: &Pubkey) -> Result<CoreAsset> {
    require_keys_eq!(*asset.owner, mpl_core::ID, TmbError::InvalidAsset);
    let data = asset.try_borrow_data()?;
    let parsed = BaseAssetV1::from_bytes(&data).map_err(|_| error!(TmbError::InvalidAsset))?;
    require!(
        parsed.update_authority == UpdateAuthority::Collection(*collection),
        TmbError::InvalidAsset
    );
    Ok(CoreAsset {
        owner: parsed.owner,
        name: parsed.name,
        uri: parsed.uri,
    })
}

pub fn escrow_auth_seeds(bump: &u8) -> [&[u8]; 2] {
    [ESCROW_AUTH_SEED, std::slice::from_ref(bump)]
}

pub fn config_seeds(bump: &u8) -> [&[u8]; 2] {
    [CONFIG_SEED, std::slice::from_ref(bump)]
}

pub fn vault_seeds(bump: &u8) -> [&[u8]; 2] {
    [VAULT_SEED, std::slice::from_ref(bump)]
}

/// Mints a Core asset into the Bro collection. Collection update authority is the config PDA.
#[allow(clippy::too_many_arguments)]
pub fn core_mint<'info>(
    mpl_core: &AccountInfo<'info>,
    asset: &AccountInfo<'info>,
    collection: &AccountInfo<'info>,
    config: &AccountInfo<'info>,
    config_bump: u8,
    payer: &AccountInfo<'info>,
    owner: &AccountInfo<'info>,
    system: &AccountInfo<'info>,
    name: String,
    uri: String,
) -> Result<()> {
    let seeds = config_seeds(&config_bump);
    CreateV2CpiBuilder::new(mpl_core)
        .asset(asset)
        .collection(Some(collection))
        .authority(Some(config))
        .payer(payer)
        .owner(Some(owner))
        .system_program(system)
        .data_state(DataState::AccountState)
        .name(name)
        .uri(uri)
        .invoke_signed(&[&seeds])?;
    Ok(())
}

pub fn core_transfer_by_user<'info>(
    mpl_core: &AccountInfo<'info>,
    asset: &AccountInfo<'info>,
    collection: &AccountInfo<'info>,
    user: &AccountInfo<'info>,
    new_owner: &AccountInfo<'info>,
    system: &AccountInfo<'info>,
) -> Result<()> {
    TransferV1CpiBuilder::new(mpl_core)
        .asset(asset)
        .collection(Some(collection))
        .payer(user)
        .authority(Some(user))
        .new_owner(new_owner)
        .system_program(Some(system))
        .invoke()?;
    Ok(())
}

#[allow(clippy::too_many_arguments)]
pub fn core_transfer_from_escrow<'info>(
    mpl_core: &AccountInfo<'info>,
    asset: &AccountInfo<'info>,
    collection: &AccountInfo<'info>,
    payer: &AccountInfo<'info>,
    escrow_auth: &AccountInfo<'info>,
    escrow_auth_bump: u8,
    new_owner: &AccountInfo<'info>,
    system: &AccountInfo<'info>,
) -> Result<()> {
    let seeds = escrow_auth_seeds(&escrow_auth_bump);
    TransferV1CpiBuilder::new(mpl_core)
        .asset(asset)
        .collection(Some(collection))
        .payer(payer)
        .authority(Some(escrow_auth))
        .new_owner(new_owner)
        .system_program(Some(system))
        .invoke_signed(&[&seeds])?;
    Ok(())
}

pub fn core_create_collection<'info>(
    mpl_core: &AccountInfo<'info>,
    collection: &AccountInfo<'info>,
    config: &AccountInfo<'info>,
    payer: &AccountInfo<'info>,
    system: &AccountInfo<'info>,
    name: String,
    uri: String,
) -> Result<()> {
    CreateCollectionV2CpiBuilder::new(mpl_core)
        .collection(collection)
        .update_authority(Some(config))
        .payer(payer)
        .system_program(system)
        .name(name)
        .uri(uri)
        .invoke()?;
    Ok(())
}

// ---------------------------------------------------------------------------------------------
// Switchboard On-Demand randomness (owner-pinned, hand parsed)
// ---------------------------------------------------------------------------------------------

pub struct Randomness {
    pub authority: Pubkey,
    pub seed_slot: u64,
    pub reveal_slot: u64,
    pub value: [u8; 32],
}

pub fn parse_randomness(info: &AccountInfo) -> Result<Randomness> {
    require_keys_eq!(
        *info.owner,
        SWITCHBOARD_PROGRAM_ID,
        TmbError::StaleRandomness
    );
    let d = info.try_borrow_data()?;
    require!(d.len() >= SB_MIN_LEN, TmbError::StaleRandomness);
    require!(
        d[..8] == SB_RANDOMNESS_DISCRIMINATOR,
        TmbError::StaleRandomness
    );
    let u64_at = |o: usize| {
        let mut b = [0u8; 8];
        b.copy_from_slice(&d[o..o + 8]);
        u64::from_le_bytes(b)
    };
    let mut authority = [0u8; 32];
    authority.copy_from_slice(&d[SB_OFF_AUTHORITY..SB_OFF_AUTHORITY + 32]);
    let mut value = [0u8; 32];
    value.copy_from_slice(&d[SB_OFF_VALUE..SB_OFF_VALUE + 32]);
    Ok(Randomness {
        authority: Pubkey::new_from_array(authority),
        seed_slot: u64_at(SB_OFF_SEED_SLOT),
        reveal_slot: u64_at(SB_OFF_REVEAL_SLOT),
        value,
    })
}

// ---------------------------------------------------------------------------------------------
// PDA creation that survives pre-funded (griefed) addresses
// ---------------------------------------------------------------------------------------------

pub fn create_pda<'info>(
    payer: &AccountInfo<'info>,
    pda: &AccountInfo<'info>,
    system: &AccountInfo<'info>,
    owner: &Pubkey,
    space: usize,
    seeds: &[&[u8]],
) -> Result<()> {
    let rent = Rent::get()?.minimum_balance(space);
    let signer: &[&[&[u8]]] = &[seeds];
    if pda.lamports() == 0 {
        system_program::create_account(
            CpiContext::new_with_signer(
                system.clone(),
                system_program::CreateAccount {
                    from: payer.clone(),
                    to: pda.clone(),
                },
                signer,
            ),
            rent,
            space as u64,
            owner,
        )?;
    } else {
        let need = rent.saturating_sub(pda.lamports());
        if need > 0 {
            system_program::transfer(
                CpiContext::new(
                    system.clone(),
                    system_program::Transfer {
                        from: payer.clone(),
                        to: pda.clone(),
                    },
                ),
                need,
            )?;
        }
        system_program::allocate(
            CpiContext::new_with_signer(
                system.clone(),
                system_program::Allocate {
                    account_to_allocate: pda.clone(),
                },
                signer,
            ),
            space as u64,
        )?;
        system_program::assign(
            CpiContext::new_with_signer(
                system.clone(),
                system_program::Assign {
                    account_to_assign: pda.clone(),
                },
                signer,
            ),
            owner,
        )?;
    }
    Ok(())
}

// ---------------------------------------------------------------------------------------------
// Loss + atomic burn (shared by settle_spin and cancel_stale_spin)
// ---------------------------------------------------------------------------------------------

pub struct BurnInfos<'a, 'info> {
    pub asset: &'a AccountInfo<'info>,
    pub collection: &'a AccountInfo<'info>,
    pub escrow_auth: &'a AccountInfo<'info>,
    pub owner: &'a AccountInfo<'info>,
    pub graveyard: &'a AccountInfo<'info>,
    pub settler: &'a AccountInfo<'info>,
    pub mpl_core: &'a AccountInfo<'info>,
    pub system: &'a AccountInfo<'info>,
}

/// Burns the escrowed Core asset, records it in the Graveyard and forwards reclaimed rent to the
/// owner. Balance stays in the vault as pool; holdings are dropped (tokens stay in the vault).
pub fn execute_burn<'a, 'info>(
    config: &mut Account<'info, Config>,
    bro: &mut Account<'info, BroRecord>,
    escrow_receipt: &Account<'info, EscrowReceipt>,
    i: &BurnInfos<'a, 'info>,
    graveyard_bump: u8,
) -> Result<()> {
    let core = read_bro_asset(i.asset, &config.collection)?;
    require_keys_eq!(core.owner, i.escrow_auth.key(), TmbError::InvalidAsset);

    // --- state first ---
    config.total_user_tmb = config
        .total_user_tmb
        .checked_sub(bro.tmb_balance)
        .ok_or(TmbError::Overflow)?;
    bro.tmb_balance = 0;
    bro.holdings.clear();
    bro.status = BroStatus::Burned;
    bro.in_escrow = false;

    // --- graveyard entry ---
    let grave = Graveyard {
        asset: bro.asset,
        last_owner: bro.owner,
        burned_at: Clock::get()?.unix_timestamp,
        metadata_uri: core.uri,
        name: core.name,
        bump: graveyard_bump,
    };
    let asset_key = bro.asset;
    let bump_arr = [graveyard_bump];
    let seeds: [&[u8]; 3] = [GRAVEYARD_SEED, asset_key.as_ref(), &bump_arr];
    create_pda(
        i.settler,
        i.graveyard,
        i.system,
        &crate::ID,
        8 + Graveyard::INIT_SPACE,
        &seeds,
    )?;
    {
        let mut data = i.graveyard.try_borrow_mut_data()?;
        let mut w: &mut [u8] = &mut data;
        grave.try_serialize(&mut w)?;
    }

    // --- burn (escrow authority owns the asset; it signs as owner and receives the rent) ---
    let auth_bump = config.escrow_auth_bump;
    let auth_seeds = escrow_auth_seeds(&auth_bump);
    BurnV1CpiBuilder::new(i.mpl_core)
        .asset(i.asset)
        .collection(Some(i.collection))
        .payer(i.escrow_auth)
        .authority(Some(i.escrow_auth))
        .system_program(Some(i.system))
        .invoke_signed(&[&auth_seeds])?;

    // forward whatever rent the burn returned to the escrow authority to the owner
    let reclaimed = i.escrow_auth.lamports();
    if reclaimed > 0 {
        system_program::transfer(
            CpiContext::new_with_signer(
                i.system.clone(),
                system_program::Transfer {
                    from: i.escrow_auth.clone(),
                    to: i.owner.clone(),
                },
                &[&auth_seeds],
            ),
            reclaimed,
        )?;
    }

    // --- close the escrow receipt to the owner ---
    escrow_receipt.close(i.owner.clone())?;
    Ok(())
}

/// Applies a loss to the record. Returns true when the streak reaches the burn threshold.
pub fn apply_loss(config: &Config, bro: &mut BroRecord) -> bool {
    bro.loss_streak = bro.loss_streak.saturating_add(1);
    bro.loss_streak >= config.burn_at_loss_streak
}

pub fn now_slot() -> Result<u64> {
    Ok(Clock::get()?.slot)
}

#[allow(clippy::too_many_arguments)]
pub fn emit_settled(
    bro: &BroRecord,
    spin: &SpinRequest,
    tier: u8,
    outcome: u8,
    wedge_index: u8,
    prize: Option<&Prize>,
    burned: bool,
    bonus_asset: Pubkey,
    spin_index: u8,
    spin_count: u8,
) {
    emit!(SpinSettled {
        asset: bro.asset,
        owner: bro.owner,
        amount: spin.amount,
        odds_tier: tier,
        outcome,
        wedge_index,
        prize_id: prize.map(|p| p.id).unwrap_or([0; 16]),
        prize_kind: prize.map(|p| p.kind as u8).unwrap_or(0),
        prize_amount: prize.map(|p| p.amount).unwrap_or(0),
        new_streak: bro.loss_streak,
        burned,
        new_balance: bro.tmb_balance,
        bonus_asset,
        spin_index,
        spin_count,
    });
}
