import {
  UpdateOrganisationDocument,
  UpdateProfileDocument,
} from '@tenda/api-client'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'

import type { ViewerPayload } from '../auth/api'
import { PersonAvatar } from '../components/AuthenticatedImage'
import { UploadField } from '../components/ui'
import { graphqlRequest, TendaApiError } from '../lib/http'
import { uploadPrivateFile } from '../inventory/api'
import { BankDetailsSection } from './BankDetailsSection'

export function ProfilePage() {
  const viewer = useOutletContext<ViewerPayload>()
  const queryClient = useQueryClient()
  const canManageStore = viewer.membership.permissions.manageSensitiveConfiguration
  const [fullName, setFullName] = useState(viewer.viewer.profile.fullName)
  const [phone, setPhone] = useState(viewer.viewer.profile.phone)
  const [storeName, setStoreName] = useState(viewer.organisation.name)
  const [address, setAddress] = useState(viewer.organisation.address)
  const [description, setDescription] = useState(viewer.organisation.description)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  function refreshViewer() {
    void queryClient.invalidateQueries({ queryKey: ['viewer'] })
  }

  const saveProfile = useMutation({
    mutationFn: (photoAssetId?: string) =>
      graphqlRequest(UpdateProfileDocument, {
        input: { fullName, phone, photoAssetId },
      }),
    onSuccess: () => {
      setMessage('Guardamos tu perfil.')
      setError('')
      refreshViewer()
    },
    onError: (saveError: unknown) => {
      setMessage('')
      setError(
        saveError instanceof TendaApiError
          ? saveError.message
          : 'No pudimos guardar tu perfil.',
      )
    },
  })

  const saveStore = useMutation({
    mutationFn: (logoAssetId?: string) =>
      graphqlRequest(UpdateOrganisationDocument, {
        input: {
          name: storeName,
          phone: viewer.organisation.phone,
          businessEmail: viewer.organisation.businessEmail,
          timezone: viewer.organisation.timezone,
          address,
          description,
          logoAssetId,
        },
      }),
    onSuccess: () => {
      setMessage('Guardamos los datos de la tienda.')
      setError('')
      refreshViewer()
    },
    onError: (saveError: unknown) => {
      setMessage('')
      setError(
        saveError instanceof TendaApiError
          ? saveError.message
          : 'No pudimos guardar la tienda.',
      )
    },
  })

  const uploadPhoto = useMutation({
    mutationFn: (file: File) => uploadPrivateFile(file, 'profile_photo'),
    onSuccess: (assetId) => saveProfile.mutate(assetId),
    onError: () => setError('No pudimos cargar tu foto.'),
  })

  const uploadLogo = useMutation({
    mutationFn: (file: File) => uploadPrivateFile(file, 'organisation_logo'),
    onSuccess: (assetId) => saveStore.mutate(assetId),
    onError: () => setError('No pudimos cargar el logo.'),
  })

  const personName = fullName || viewer.viewer.email

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">Cuenta y negocio</p>
          <h1>Perfil y negocio</h1>
          <p>Tus datos personales y la ficha pública de la tienda.</p>
        </div>
      </header>

      {message ? (
        <p className="form-message" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="form-message form-message--error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="profile-grid">
        <section className="profile-card" aria-labelledby="person-title">
          <div className="profile-card__intro">
            <PersonAvatar
              name={personName}
              photoUrl={viewer.viewer.profile.photoUrl}
              className="avatar avatar--lg"
            />
            <div>
              <h2 id="person-title">Tu perfil</h2>
              <p className="profile-role">{viewer.membership.roleLabel}</p>
            </div>
          </div>
          <form
            className="profile-form"
            onSubmit={(event) => {
              event.preventDefault()
              saveProfile.mutate(undefined)
            }}
          >
            <label className="field">
              Correo
              <input value={viewer.viewer.email} readOnly />
            </label>
            <label className="field">
              Nombre
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                autoComplete="name"
              />
            </label>
            <label className="field">
              Teléfono
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                autoComplete="tel"
              />
            </label>
            <UploadField
              label="Foto de perfil"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploadPhoto.isPending}
              onSelect={(file) => uploadPhoto.mutate(file)}
            />
            <button
              className="button button--primary"
              type="submit"
              disabled={saveProfile.isPending}
            >
              {saveProfile.isPending ? 'Guardando…' : 'Guardar perfil'}
            </button>
          </form>
        </section>

        <section className="profile-card" aria-labelledby="store-title">
          <div className="profile-card__intro">
            <PersonAvatar
              name={storeName}
              photoUrl={viewer.organisation.logoUrl}
              className="avatar avatar--lg avatar--square"
            />
            <div>
              <h2 id="store-title">Tu tienda</h2>
              <p>Nombre, logo, dirección y descripción.</p>
            </div>
          </div>
          <form
            className="profile-form"
            onSubmit={(event) => {
              event.preventDefault()
              if (!canManageStore) return
              saveStore.mutate(undefined)
            }}
          >
            <label className="field">
              Nombre de la tienda
              <input
                value={storeName}
                onChange={(event) => setStoreName(event.target.value)}
                disabled={!canManageStore}
              />
            </label>
            <label className="field">
              Dirección
              <input
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                disabled={!canManageStore}
              />
            </label>
            <label className="field">
              Descripción
              <textarea
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={!canManageStore}
              />
            </label>
            {canManageStore ? (
              <UploadField
                label="Logo de la tienda"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploadLogo.isPending}
                onSelect={(file) => uploadLogo.mutate(file)}
              />
            ) : (
              <p className="field__hint">Solo quien titula la tienda puede editar estos datos.</p>
            )}
            {canManageStore ? (
              <button
                className="button button--primary"
                type="submit"
                disabled={saveStore.isPending}
              >
                {saveStore.isPending ? 'Guardando…' : 'Guardar tienda'}
              </button>
            ) : null}
          </form>
        </section>

        <BankDetailsSection
          viewer={viewer}
          canManage={canManageStore}
          onSaved={(status) => {
            setMessage(status)
            setError('')
            refreshViewer()
          }}
          onError={(status) => {
            setMessage('')
            setError(status)
          }}
        />
      </div>
    </>
  )
}
