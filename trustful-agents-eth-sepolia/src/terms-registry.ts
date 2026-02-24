import {
  EmergencyWithdrawal as EmergencyWithdrawalEvent,
  Paused as PausedEvent,
  PauserAdded as PauserAddedEvent,
  PauserRemoved as PauserRemovedEvent,
  TermsActivated as TermsActivatedEvent,
  TermsDeactivated as TermsDeactivatedEvent,
  TermsInvalidated as TermsInvalidatedEvent,
  TermsRegistered as TermsRegisteredEvent,
  Unpaused as UnpausedEvent,
} from "../generated/TermsRegistry/TermsRegistry"
import {
  EmergencyWithdrawal,
  Paused,
  PauserAdded,
  PauserRemoved,
  TermsActivated,
  TermsDeactivated,
  TermsInvalidated,
  TermsRegistered,
  Unpaused,
} from "../generated/schema"

export function handleEmergencyWithdrawal(
  event: EmergencyWithdrawalEvent,
): void {
  let entity = new EmergencyWithdrawal(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
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
    event.transaction.hash.concatI32(event.logIndex.toI32()),
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
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )
  entity.pauser = event.params.pauser

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handlePauserRemoved(event: PauserRemovedEvent): void {
  let entity = new PauserRemoved(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )
  entity.pauser = event.params.pauser

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleTermsActivated(event: TermsActivatedEvent): void {
  let entity = new TermsActivated(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )
  entity.agentId = event.params.agentId
  entity.version = event.params.version

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleTermsDeactivated(event: TermsDeactivatedEvent): void {
  let entity = new TermsDeactivated(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )
  entity.agentId = event.params.agentId
  entity.version = event.params.version

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleTermsInvalidated(event: TermsInvalidatedEvent): void {
  let entity = new TermsInvalidated(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )
  entity.agentId = event.params.agentId
  entity.reason = event.params.reason

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleTermsRegistered(event: TermsRegisteredEvent): void {
  let entity = new TermsRegistered(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )
  entity.agentId = event.params.agentId
  entity.version = event.params.version
  entity.contentHash = event.params.contentHash
  entity.contentUri = event.params.contentUri
  entity.councilId = event.params.councilId

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleUnpaused(event: UnpausedEvent): void {
  let entity = new Unpaused(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  )
  entity.by = event.params.by
  entity.scope = event.params.scope

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}
