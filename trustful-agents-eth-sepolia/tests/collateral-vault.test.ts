import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll
} from "matchstick-as/assembly/index"
import { BigInt, Address } from "@graphprotocol/graph-ts"
import { CollateralLocked } from "../generated/schema"
import { CollateralLocked as CollateralLockedEvent } from "../generated/CollateralVault/CollateralVault"
import { handleCollateralLocked } from "../src/collateral-vault"
import { createCollateralLockedEvent } from "./collateral-vault-utils"

// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#tests-structure

describe("Describe entity assertions", () => {
  beforeAll(() => {
    let agentId = BigInt.fromI32(234)
    let claimId = BigInt.fromI32(234)
    let amount = BigInt.fromI32(234)
    let newCollateralLockedEvent = createCollateralLockedEvent(
      agentId,
      claimId,
      amount
    )
    handleCollateralLocked(newCollateralLockedEvent)
  })

  afterAll(() => {
    clearStore()
  })

  // For more test scenarios, see:
  // https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#write-a-unit-test

  test("CollateralLocked created and stored", () => {
    assert.entityCount("CollateralLocked", 1)

    // 0xa16081f360e3847006db660bae1c6d1b2e17ec2a is the default address used in newMockEvent() function
    assert.fieldEquals(
      "CollateralLocked",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "agentId",
      "234"
    )
    assert.fieldEquals(
      "CollateralLocked",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "claimId",
      "234"
    )
    assert.fieldEquals(
      "CollateralLocked",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "amount",
      "234"
    )

    // More assert options:
    // https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#asserts
  })
})
