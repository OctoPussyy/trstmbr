use solana_program::{
    account_info::AccountInfo, clock::Clock, entrypoint, entrypoint::ProgramResult,
    program_error::ProgramError, pubkey::Pubkey, sysvar::Sysvar,
};

entrypoint!(process);

const DISC: [u8; 8] = [10, 66, 229, 135, 220, 239, 217, 114];
const OFF_AUTHORITY: usize = 8;
const OFF_SEED_SLOT: usize = 104;
const OFF_REVEAL_SLOT: usize = 144;
const OFF_VALUE: usize = 152;
pub const LEN: usize = 408;

/// ix 0: commit          accounts [randomness(w), authority]        data [0]
/// ix 1: reveal          accounts [randomness(w)]                   data [1, value:32]
/// ix 2: commit at slot  accounts [randomness(w), authority]        data [2, seed_slot:u64]
fn process(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    let acc = accounts.first().ok_or(ProgramError::NotEnoughAccountKeys)?;
    if acc.owner != program_id || !acc.is_writable || acc.data_len() < LEN {
        return Err(ProgramError::InvalidAccountData);
    }
    let slot = Clock::get()?.slot;
    let mut d = acc.try_borrow_mut_data()?;
    match data.first() {
        Some(0) | Some(2) => {
            let authority = accounts.get(1).ok_or(ProgramError::NotEnoughAccountKeys)?;
            let seed_slot = if data[0] == 2 {
                u64::from_le_bytes(data[1..9].try_into().map_err(|_| ProgramError::InvalidInstructionData)?)
            } else {
                slot.saturating_sub(1)
            };
            d.fill(0);
            d[..8].copy_from_slice(&DISC);
            d[OFF_AUTHORITY..OFF_AUTHORITY + 32].copy_from_slice(authority.key.as_ref());
            d[OFF_SEED_SLOT..OFF_SEED_SLOT + 8].copy_from_slice(&seed_slot.to_le_bytes());
        }
        Some(1) => {
            if data.len() < 33 || d[..8] != DISC {
                return Err(ProgramError::InvalidInstructionData);
            }
            d[OFF_REVEAL_SLOT..OFF_REVEAL_SLOT + 8].copy_from_slice(&slot.to_le_bytes());
            d[OFF_VALUE..OFF_VALUE + 32].copy_from_slice(&data[1..33]);
        }
        _ => return Err(ProgramError::InvalidInstructionData),
    }
    Ok(())
}
