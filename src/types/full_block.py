from dataclasses import dataclass
from typing import Tuple, List, Optional
from blspy import G2Element
from src.types.name_puzzle_condition import NPC
from src.types.coin import Coin
from src.types.sized_bytes import bytes32
from src.full_node.mempool_check_conditions import get_name_puzzle_conditions
from src.util.condition_tools import created_outputs_for_conditions_dict
from src.util.streamable import Streamable, streamable
from src.types.proof_of_time import ProofOfTime
from src.types.challenge_slot import ChallengeSlot
from src.types.reward_chain_end_of_slot import RewardChainEndOfSlot
from src.types.reward_chain_sub_block import RewardChainInfusionPoint, RewardChainSubBlock
from src.types.foliage import FoliageSubBlock, FoliageBlock, TransactionsInfo
from src.types.program import Program


def additions_for_npc(npc_list: List[NPC]) -> List[Coin]:
    additions: List[Coin] = []

    for npc in npc_list:
        for coin in created_outputs_for_conditions_dict(
            npc.condition_dict, npc.coin_name
        ):
            additions.append(coin)

    return additions


@dataclass(frozen=True)
@streamable
class FullBlock(Streamable):
    # All the information required to validate a block
    finished_challenge_slots: List[ChallengeSlot]           # If first sub-block in slot
    finished_reward_slots: List[RewardChainEndOfSlot]       # If first sub-block in slot
    icp_proof_of_time: Optional[ProofOfTime]                # If included in challenge chain
    icp_signature: Optional[G2Element]                      # If included in challenge chain
    ip_proof_of_time: Optional[ProofOfTime]                 # If included in challenge chain
    reward_chain_sub_block: RewardChainSubBlock             # Reward chain trunk data
    reward_chain_infusion_point: RewardChainInfusionPoint   # Data to complete the sub-block
    foliage_sub_block: FoliageSubBlock                      # Reward chain foliage data
    foliage_block: Optional[FoliageBlock]                   # Reward chain foliage data (tx block)
    transactions_filter: bytes                              # Filter for block transactions
    transactions_info: Optional[TransactionsInfo]           # Reward chain foliage data (tx block additional)
    transactions_generator: Optional[Program]               # Program that generates transactions

    @property
    def prev_header_hash(self):
        return self.foliage_sub_block.prev_sub_block_hash

    @property
    def height(self):
        return self.reward_chain_sub_block.sub_block_height

    @property
    def weight(self):
        return self.reward_chain_sub_block.weight

    @property
    def header_hash(self):
        return self.foliage_sub_block.get_hash()

    def additions(self) -> List[Coin]:
        additions: List[Coin] = []

        if self.transactions_generator is not None:
            # This should never throw here, block must be valid if it comes to here
            err, npc_list, cost = get_name_puzzle_conditions(
                self.transactions_generator
            )
            # created coins
            if npc_list is not None:
                additions.extend(additions_for_npc(npc_list))

        additions.append(self.get_coinbase())
        additions.append(self.get_fees_coin())

        return additions

    async def tx_removals_and_additions(self) -> Tuple[List[bytes32], List[Coin]]:
        """
        Doesn't return coinbase and fee reward.
        This call assumes that this block has been validated already,
        get_name_puzzle_conditions should not return error here
        """
        removals: List[bytes32] = []
        additions: List[Coin] = []

        if self.transactions_generator is not None:
            # This should never throw here, block must be valid if it comes to here
            err, npc_list, cost = get_name_puzzle_conditions(
                self.transactions_generator
            )
            # build removals list
            if npc_list is None:
                return [], []
            for npc in npc_list:
                removals.append(npc.coin_name)

            additions.extend(additions_for_npc(npc_list))

        return removals, additions
