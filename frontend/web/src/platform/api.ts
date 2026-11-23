import type { TypedDocumentNode } from '@graphql-typed-document-node/core'
import { parse } from 'graphql'

import { graphqlRequest } from '../lib/http'

export type StaffPlanCount = {
  code: string
  name: string
  organisationCount: number
}

export type StaffPlatformOverview = {
  generatedAt: string
  organisationCount: number
  organisationsLast30Days: number
  organisationsWithSales: number
  plans: StaffPlanCount[]
  activeProductCount: number
  archivedProductCount: number
  productsMissingCost: number
  inventoryUnits: number
  inventoryReservedUnits: number
  inventoryAtCost: string
  inventoryAtSalePrice: string
  inventoryCostComplete: boolean
  confirmedSalesAmount: string
  confirmedSalesCount: number
  refundedAmount: string
  netSalesAmount: string
  knownCogs: string
  grossMargin: string
  salesCostComplete: boolean
  pendingSalesAmount: string
  pendingSalesCount: number
  pendingShipmentCount: number
}

const StaffPlatformOverviewDocument = parse(`
  query StaffPlatformOverview {
    staffPlatformOverview {
      generatedAt
      organisationCount
      organisationsLast30Days
      organisationsWithSales
      plans { code name organisationCount }
      activeProductCount
      archivedProductCount
      productsMissingCost
      inventoryUnits
      inventoryReservedUnits
      inventoryAtCost
      inventoryAtSalePrice
      inventoryCostComplete
      confirmedSalesAmount
      confirmedSalesCount
      refundedAmount
      netSalesAmount
      knownCogs
      grossMargin
      salesCostComplete
      pendingSalesAmount
      pendingSalesCount
      pendingShipmentCount
    }
  }
`) as TypedDocumentNode<
  { staffPlatformOverview: StaffPlatformOverview },
  Record<string, never>
>

export const staffKeys = {
  overview: () => ['staff', 'platform-overview'] as const,
}

export function fetchStaffPlatformOverview(): Promise<StaffPlatformOverview> {
  return graphqlRequest(StaffPlatformOverviewDocument).then(
    (data) => data.staffPlatformOverview,
  )
}
