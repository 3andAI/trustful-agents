import {
  CollateralLocked as CollateralLockedEvent,
  CollateralSlashed as CollateralSlashedEvent,
  CollateralUnlocked as CollateralUnlockedEvent,
  Deposited as DepositedEvent,
  EmergencyWithdrawal as EmergencyWithdrawalEvent,
  Paused as PausedEvent,
  PauserAdded as PauserAddedEvent,
  PauserRemoved as PauserRemovedEvent,
  Unpaused as UnpausedEvent,
  WithdrawalCancelled as WithdrawalCancelledEvent,
  WithdrawalExecuted as WithdrawalExecutedEvent,
  WithdrawalInitiated as WithdrawalInitiatedEvent
} from "../generated/CollateralVault/CollateralVault"
import {
  CollateralLocked,
  CollateralSlashed,
  CollateralUnlocked,
  Deposited,
  EmergencyWithdrawal,
  Paused,
  PauserAdded,
  PauserRemoved,
  Unpaused,
  WithdrawalCancelled,
  WithdrawalExecuted,
  WithdrawalInitiated
} from "../generated/schema"

export function handleCollateralLocked(event: CollateralLockedEvent): void {
  let entity = new CollateralLocked(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.agentId = event.params.agentId
  entity.claimId = event.params.claimId
  entity.amount = event.params.amount

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleCollateralSlashed(event: CollateralSlashedEvent): void {
  let entity = new CollateralSlashed(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.agentId = event.params.agentId
  entity.claimId = event.params.claimId
  entity.recipient = event.params.recipient
  entity.amount = event.params.amount

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleCollateralUnlocked(event: CollateralUnlockedEvent): void {
  let entity = new CollateralUnlocked(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.agentId = event.params.agentId
  entity.claimId = event.params.claimId
  entity.amount = event.params.amount

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleDeposited(event: DepositedEvent): void {
  let entity = new Deposited(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.agentId = event.params.agentId
  entity.depositor = event.params.depositor
  entity.amount = event.params.amount

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleEmergencyWithdrawal(
  event: EmergencyWithdrawalEvent
): void {
  let entity = new EmergencyWithdrawal(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.by = event.params.by
  entity.token = event.params.token
  entity.amount = event.params.amount

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handlePaused(event: PausedEvent): void {
  let entity = new Paused(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.by = event.params.by
  entity.scope = event.params.scope
  entity.reason = event.params.reason

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handlePauserAdded(event: PauserAddedEvent): void {
  let entity = new PauserAdded(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.pauser = event.params.pauser

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handlePauserRemoved(event: PauserRemovedEvent): void {
  let entity = new PauserRemoved(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.pauser = event.params.pauser

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleUnpaused(event: UnpausedEvent): void {
  let entity = new Unpaused(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.by = event.params.by
  entity.scope = event.params.scope

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleWithdrawalCancelled(
  event: WithdrawalCancelledEvent
): void {
  let entity = new WithdrawalCancelled(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.agentId = event.params.agentId

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleWithdrawalExecuted(event: WithdrawalExecutedEvent): void {
  let entity = new WithdrawalExecuted(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.agentId = event.params.agentId
  entity.recipient = event.params.recipient
  entity.amount = event.params.amount

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleWithdrawalInitiated(
  event: WithdrawalInitiatedEvent
): void {
  let entity = new WithdrawalInitiated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.agentId = event.params.agentId
  entity.amount = event.params.amount
  entity.executeAfter = event.params.executeAfter

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}
