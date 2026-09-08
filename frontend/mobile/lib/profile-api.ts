import {
  UpdateOrganisationDocument,
  UpdateProfileDocument,
} from '@tenda/api-client'

import { graphqlRequest } from './graphql'

export async function updateMobileProfile(input: {
  fullName: string
  phone: string
  photoAssetId?: string
}) {
  const data = await graphqlRequest(UpdateProfileDocument, { input })
  return data.updateProfile.profile
}

export async function updateMobileOrganisation(input: {
  name: string
  phone: string
  businessEmail: string
  timezone: string
  address: string
  description: string
  logoAssetId?: string
}) {
  const data = await graphqlRequest(UpdateOrganisationDocument, { input })
  return data.updateOrganisation.organisation
}
