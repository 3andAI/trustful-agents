import { newMockEvent } from "matchstick-as"
import { ethereum, BigInt, Address } from "@graphprotocol/graph-ts"
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
} from "../generated/CollateralVault/CollateralVault"

export function createCollateralLockedEvent(
  agentId: BigInt,
  claimId: BigInt,
  amount: BigInt
): CollateralLocked {
  let collateralLockedEvent = changetype<CollateralLocked>(newMockEvent())

  collateralLockedEvent.parameters = new Array()

  collateralLockedEvent.parameters.push(
    new ethereum.EventParam(
      "agentId",
      ethereum.Value.fromUnsignedBigInt(agentId)
    )
  )
  collateralLockedEvent.parameters.push(
    new ethereum.EventParam(
      "claimId",
      ethereum.Value.fromUnsignedBigInt(claimId)
    )
  )
  collateralLockedEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  )

  return collateralLockedEvent
}

export function createCollateralSlashedEvent(
  agentId: BigInt,
  claimId: BigInt,
  recipient: Address,
  amount: BigInt
): CollateralSlashed {
  let collateralSlashedEvent = changetype<CollateralSlashed>(newMockEvent())

  collateralSlashedEvent.parameters = new Array()

  collateralSlashedEvent.parameters.push(
    new ethereum.EventParam(
      "agentId",
      ethereum.Value.fromUnsignedBigInt(agentId)
    )
  )
  collateralSlashedEvent.parameters.push(
    new ethereum.EventParam(
      "claimId",
      ethereum.Value.fromUnsignedBigInt(claimId)
    )
  )
  collateralSlashedEvent.parameters.push(
    new ethereum.EventParam("recipient", ethereum.Value.fromAddress(recipient))
  )
  collateralSlashedEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  )

  return collateralSlashedEvent
}

export function createCollateralUnlockedEvent(
  agentId: BigInt,
  claimId: BigInt,
  amount: BigInt
): CollateralUnlocked {
  let collateralUnlockedEvent = changetype<CollateralUnlocked>(newMockEvent())

  collateralUnlockedEvent.parameters = new Array()

  collateralUnlockedEvent.parameters.push(
    new ethereum.EventParam(
      "agentId",
      ethereum.Value.fromUnsignedBigInt(agentId)
    )
  )
  collateralUnlockedEvent.parameters.push(
    new ethereum.EventParam(
      "claimId",
      ethereum.Value.fromUnsignedBigInt(claimId)
    )
  )
  collateralUnlockedEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  )

  return collateralUnlockedEvent
}

export function createDepositedEvent(
  agentId: BigInt,
  depositor: Address,
  amount: BigInt
): Deposited {
  let depositedEvent = changetype<Deposited>(newMockEvent())

  depositedEvent.parameters = new Array()

  depositedEvent.parameters.push(
    new ethereum.EventParam(
      "agentId",
      ethereum.Value.fromUnsignedBigInt(agentId)
    )
  )
  depositedEvent.parameters.push(
    new ethereum.EventParam("depositor", ethereum.Value.fromAddress(depositor))
  )
  depositedEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  )

  return depositedEvent
}

export function createEmergencyWithdrawalEvent(
  by: Address,
  token: Address,
  amount: BigInt
): EmergencyWithdrawal {
  let emergencyWithdrawalEvent = changetype<EmergencyWithdrawal>(newMockEvent())

  emergencyWithdrawalEvent.parameters = new Array()

  emergencyWithdrawalEvent.parameters.push(
    new ethereum.EventParam("by", ethereum.Value.fromAddress(by))
  )
  emergencyWithdrawalEvent.parameters.push(
    new ethereum.EventParam("token", ethereum.Value.fromAddress(token))
  )
  emergencyWithdrawalEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  )

  return emergencyWithdrawalEvent
}

export function createPausedEvent(
  by: Address,
  scope: i32,
  reason: string
): Paused {
  let pausedEvent = changetype<Paused>(newMockEvent())

  pausedEvent.parameters = new Array()

  pausedEvent.parameters.push(
    new ethereum.EventParam("by", ethereum.Value.fromAddress(by))
  )
  pausedEvent.parameters.push(
    new ethereum.EventParam(
      "scope",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(scope))
    )
  )
  pausedEvent.parameters.push(
    new ethereum.EventParam("reason", ethereum.Value.fromString(reason))
  )

  return pausedEvent
}

export function createPauserAddedEvent(pauser: Address): PauserAdded {
  let pauserAddedEvent = changetype<PauserAdded>(newMockEvent())

  pauserAddedEvent.parameters = new Array()

  pauserAddedEvent.parameters.push(
    new ethereum.EventParam("pauser", ethereum.Value.fromAddress(pauser))
  )

  return pauserAddedEvent
}

export function createPauserRemovedEvent(pauser: Address): PauserRemoved {
  let pauserRemovedEvent = changetype<PauserRemoved>(newMockEvent())

  pauserRemovedEvent.parameters = new Array()

  pauserRemovedEvent.parameters.push(
    new ethereum.EventParam("pauser", ethereum.Value.fromAddress(pauser))
  )

  return pauserRemovedEvent
}

export function createUnpausedEvent(by: Address, scope: i32): Unpaused {
  let unpausedEvent = changetype<Unpaused>(newMockEvent())

  unpausedEvent.parameters = new Array()

  unpausedEvent.parameters.push(
    new ethereum.EventParam("by", ethereum.Value.fromAddress(by))
  )
  unpausedEvent.parameters.push(
    new ethereum.EventParam(
      "scope",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(scope))
    )
  )

  return unpausedEvent
}

export function createWithdrawalCancelledEvent(
  agentId: BigInt
): WithdrawalCancelled {
  let withdrawalCancelledEvent = changetype<WithdrawalCancelled>(newMockEvent())

  withdrawalCancelledEvent.parameters = new Array()

  withdrawalCancelledEvent.parameters.push(
    new ethereum.EventParam(
      "agentId",
      ethereum.Value.fromUnsignedBigInt(agentId)
    )
  )

  return withdrawalCancelledEvent
}

export function createWithdrawalExecutedEvent(
  agentId: BigInt,
  recipient: Address,
  amount: BigInt
): WithdrawalExecuted {
  let withdrawalExecutedEvent = changetype<WithdrawalExecuted>(newMockEvent())

  withdrawalExecutedEvent.parameters = new Array()

  withdrawalExecutedEvent.parameters.push(
    new ethereum.EventParam(
      "agentId",
      ethereum.Value.fromUnsignedBigInt(agentId)
    )
  )
  withdrawalExecutedEvent.parameters.push(
    new ethereum.EventParam("recipient", ethereum.Value.fromAddress(recipient))
  )
  withdrawalExecutedEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  )

  return withdrawalExecutedEvent
}

export function createWithdrawalInitiatedEvent(
  agentId: BigInt,
  amount: BigInt,
  executeAfter: BigInt
): WithdrawalInitiated {
  let withdrawalInitiatedEvent = changetype<WithdrawalInitiated>(newMockEvent())

  withdrawalInitiatedEvent.parameters = new Array()

  withdrawalInitiatedEvent.parameters.push(
    new ethereum.EventParam(
      "agentId",
      ethereum.Value.fromUnsignedBigInt(agentId)
    )
  )
  withdrawalInitiatedEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  )
  withdrawalInitiatedEvent.parameters.push(
    new ethereum.EventParam(
      "executeAfter",
      ethereum.Value.fromUnsignedBigInt(executeAfter)
    )
  )

  return withdrawalInitiatedEvent
}
