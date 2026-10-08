import type { TypedDocumentNode } from '@graphql-typed-document-node/core'
import { parse } from 'graphql'

import { graphqlRequest } from '../lib/http'

export type TermsAndConditions = {
  title: string
  bodyHtml: string
  updatedAt: string
}

type TermsQuery = {
  termsAndConditions: TermsAndConditions | null
}

const TermsAndConditionsDocument = parse(`
  query TermsAndConditions {
    termsAndConditions {
      title
      bodyHtml
      updatedAt
    }
  }
`) as TypedDocumentNode<TermsQuery, Record<string, never>>

export const termsKeys = {
  root: ['termsAndConditions'] as const,
}

export async function fetchTermsAndConditions(): Promise<TermsAndConditions | null> {
  const data = await graphqlRequest(TermsAndConditionsDocument)
  return data.termsAndConditions
}
