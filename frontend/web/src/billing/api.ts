import type { TypedDocumentNode } from '@graphql-typed-document-node/core'
import { parse } from 'graphql'

import { graphqlRequest } from '../lib/http'

export type BillingPlan = {
  code: string
  name: string
  priceClp: number
  productLimit: number | null
  aiAssistedEnabled: boolean
  isCurrent: boolean
}

export type OrganisationBilling = {
  planCode: string
  planName: string
  priceClp: number
  productLimit: number | null
  productCount: number
  remainingSlots: number | null
  aiAssistedEnabled: boolean
  canCreateProduct: boolean
  subscriptionStatus: string
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: string | null
  plans: BillingPlan[]
}

type OrganisationBillingQuery = {
  organisationBilling: OrganisationBilling
}

type StartPlanCheckoutMutation = {
  startPlanCheckout: {
    initPoint: string
    planCode: string
    preapprovalId: string
  }
}

type CancelSubscriptionMutation = {
  cancelSubscription: { organisationBilling: OrganisationBilling }
}

type ResumeSubscriptionMutation = {
  resumeSubscription: { organisationBilling: OrganisationBilling }
}

const BILLING_FIELDS = `
  planCode
  planName
  priceClp
  productLimit
  productCount
  remainingSlots
  aiAssistedEnabled
  canCreateProduct
  subscriptionStatus
  cancelAtPeriodEnd
  currentPeriodEnd
  plans {
    code
    name
    priceClp
    productLimit
    aiAssistedEnabled
    isCurrent
  }
`

const OrganisationBillingDocument = parse(`
  query OrganisationBilling {
    organisationBilling { ${BILLING_FIELDS} }
  }
`) as TypedDocumentNode<OrganisationBillingQuery, Record<string, never>>

const StartPlanCheckoutDocument = parse(`
  mutation StartPlanCheckout($planCode: String!, $payerEmail: String) {
    startPlanCheckout(planCode: $planCode, payerEmail: $payerEmail) {
      initPoint
      planCode
      preapprovalId
    }
  }
`) as TypedDocumentNode<
  StartPlanCheckoutMutation,
  { planCode: string; payerEmail?: string | null }
>

const CancelSubscriptionDocument = parse(`
  mutation CancelSubscription {
    cancelSubscription {
      organisationBilling { ${BILLING_FIELDS} }
    }
  }
`) as TypedDocumentNode<CancelSubscriptionMutation, Record<string, never>>

const ResumeSubscriptionDocument = parse(`
  mutation ResumeSubscription {
    resumeSubscription {
      organisationBilling { ${BILLING_FIELDS} }
    }
  }
`) as TypedDocumentNode<ResumeSubscriptionMutation, Record<string, never>>

export const billingKeys = {
  root: ['billing'] as const,
  organisation: () => [...billingKeys.root, 'organisation'] as const,
}

export async function fetchOrganisationBilling(): Promise<OrganisationBilling> {
  const data = await graphqlRequest(OrganisationBillingDocument)
  return data.organisationBilling
}

export async function startPlanCheckout(input: {
  planCode: string
  payerEmail?: string
}): Promise<{ initPoint: string; planCode: string; preapprovalId: string }> {
  const data = await graphqlRequest(StartPlanCheckoutDocument, {
    planCode: input.planCode,
    payerEmail: input.payerEmail,
  })
  return data.startPlanCheckout
}

export async function cancelSubscription(): Promise<OrganisationBilling> {
  const data = await graphqlRequest(CancelSubscriptionDocument)
  return data.cancelSubscription.organisationBilling
}

export async function resumeSubscription(): Promise<OrganisationBilling> {
  const data = await graphqlRequest(ResumeSubscriptionDocument)
  return data.resumeSubscription.organisationBilling
}

export function formatPlanPrice(priceClp: number): string {
  if (priceClp <= 0) return 'Gratis'
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(priceClp)
}

export function formatProductLimit(limit: number | null | undefined): string {
  if (limit == null) return 'Productos ilimitados'
  return `Hasta ${limit} productos`
}
