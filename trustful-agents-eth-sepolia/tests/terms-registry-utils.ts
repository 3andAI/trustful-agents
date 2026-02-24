import { newMockEvent } from "matchstick-as"
import { ethereum, Address, BigInt, Bytes } from "@graphprotocol/graph-ts"
import {
  EmergencyWithdrawal,
  Paused,
  PauserAdded,
  PauserRemoved,
  TermsActivated,
  TermsDeactivated,
  TermsInvalidated,
  TermsRegistered,
  Unpaused
} from "../generated/TermsRegistry/TermsRegistry"

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

export function createTermsActivatedEvent(
  agentId: BigInt,
  version: BigInt
): TermsActivated {
  let termsActivatedEvent = changetype<TermsActivated>(newMockEvent())

  termsActivatedEvent.parameters = new Array()

  termsActivatedEvent.parameters.push(
    new ethereum.EventParam(
      "agentId",
      ethereum.Value.fromUnsignedBigInt(agentId)
    )
  )
  termsActivatedEvent.parameters.push(
    new ethereum.EventParam(
      "version",
      ethereum.Value.fromUnsignedBigInt(version)
    )
  )

  return termsActivatedEvent
}

export function createTermsDeactivatedEvent(
  agentId: BigInt,
  version: BigInt
): TermsDeactivated {
  let termsDeactivatedEvent = changetype<TermsDeactivated>(newMockEvent())

  termsDeactivatedEvent.parameters = new Array()

  termsDeactivatedEvent.parameters.push(
    new ethereum.EventParam(
      "agentId",
      ethereum.Value.fromUnsignedBigInt(agentId)
    )
  )
  termsDeactivatedEvent.parameters.push(
    new ethereum.EventParam(
      "version",
      ethereum.Value.fromUnsignedBigInt(version)
    )
  )

  return termsDeactivatedEvent
}

export function createTermsInvalidatedEvent(
  agentId: BigInt,
  reason: string
): TermsInvalidated {
  let termsInvalidatedEvent = changetype<TermsInvalidated>(newMockEvent())

  termsInvalidatedEvent.parameters = new Array()

  termsInvalidatedEvent.parameters.push(
    new ethereum.EventParam(
      "agentId",
      ethereum.Value.fromUnsignedBigInt(agentId)
    )
  )
  termsInvalidatedEvent.parameters.push(
    new ethereum.EventParam("reason", ethereum.Value.fromString(reason))
  )

  return termsInvalidatedEvent
}

export function createTermsRegisteredEvent(
  agentId: BigInt,
  version: BigInt,
  contentHash: Bytes,
  contentUri: string,
  councilId: Bytes
): TermsRegistered {
  let termsRegisteredEvent = changetype<TermsRegistered>(newMockEvent())

  termsRegisteredEvent.parameters = new Array()

  termsRegisteredEvent.parameters.push(
    new ethereum.EventParam(
      "agentId",
      ethereum.Value.fromUnsignedBigInt(agentId)
    )
  )
  termsRegisteredEvent.parameters.push(
    new ethereum.EventParam(
      "version",
      ethereum.Value.fromUnsignedBigInt(version)
    )
  )
  termsRegisteredEvent.parameters.push(
    new ethereum.EventParam(
      "contentHash",
      ethereum.Value.fromFixedBytes(contentHash)
    )
  )
  termsRegisteredEvent.parameters.push(
    new ethereum.EventParam("contentUri", ethereum.Value.fromString(contentUri))
  )
  termsRegisteredEvent.parameters.push(
    new ethereum.EventParam(
      "councilId",
      ethereum.Value.fromFixedBytes(councilId)
    )
  )

  return termsRegisteredEvent
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
