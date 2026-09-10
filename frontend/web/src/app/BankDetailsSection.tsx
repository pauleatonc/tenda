import {
  BANK_ACCOUNT_TYPES,
  CHILEAN_BANKS,
  OTHER_BANK,
  UpdateOrganisationDocument,
  accountTypeLabel,
  formatRutInput,
  isValidChileanRut,
  organisationHasBankDetails,
} from '@tenda/api-client'
import { useMutation } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import type { ViewerPayload } from '../auth/api'
import { TendaApiError, graphqlRequest } from '../lib/http'
import { BankTransferDetails } from '../public/BankTransferDetails'

type FieldErrors = Partial<Record<string, string>>

function fieldError(error: unknown, key: string): string {
  if (error instanceof TendaApiError) {
    return error.fieldErrors[key]?.[0] ?? ''
  }
  return ''
}

export function BankDetailsSection({
  viewer,
  canManage,
  onSaved,
  onError,
}: {
  viewer: ViewerPayload
  canManage: boolean
  onSaved: (message: string) => void
  onError: (message: string) => void
}) {
  const organisation = viewer.organisation
  const listedBank = CHILEAN_BANKS.includes(
    (organisation.bankName ?? '') as (typeof CHILEAN_BANKS)[number],
  )
  const [bankName, setBankName] = useState(
    listedBank || !organisation.bankName ? (organisation.bankName ?? '') : OTHER_BANK,
  )
  const [customBank, setCustomBank] = useState(listedBank ? '' : (organisation.bankName ?? ''))
  const [accountType, setAccountType] = useState(organisation.bankAccountType ?? '')
  const [accountNumber, setAccountNumber] = useState(organisation.bankAccountNumber ?? '')
  const [taxId, setTaxId] = useState(organisation.bankHolderTaxId ?? '')
  const [email, setEmail] = useState(
    organisation.bankConfirmationEmail || viewer.viewer.email,
  )
  const [errors, setErrors] = useState<FieldErrors>({})

  const resolvedBank = bankName === OTHER_BANK ? customBank.trim() : bankName
  const complete = organisationHasBankDetails({
    bankName: resolvedBank,
    bankAccountType: accountType,
    bankAccountNumber: accountNumber,
    bankHolderTaxId: taxId,
    bankConfirmationEmail: email,
  })

  const preview = useMemo(() => {
    if (!complete) return null
    return {
      bankName: resolvedBank,
      accountType,
      accountTypeLabel: accountTypeLabel(accountType),
      accountNumber: accountNumber.trim(),
      taxId: formatRutInput(taxId),
      confirmationEmail: email.trim(),
    }
  }, [accountNumber, accountType, complete, email, resolvedBank, taxId])

  const saveBank = useMutation({
    mutationFn: () => {
      const nextErrors: FieldErrors = {}
      if (!resolvedBank) nextErrors.bankName = 'Indica el banco.'
      if (!accountType) nextErrors.bankAccountType = 'Selecciona un tipo de cuenta.'
      if (!/^\d{5,20}$/.test(accountNumber.replace(/\s/g, ''))) {
        nextErrors.bankAccountNumber = 'Ingresa el número de cuenta, solo dígitos.'
      }
      if (!isValidChileanRut(taxId)) nextErrors.bankHolderTaxId = 'Ingresa un RUT válido.'
      if (!email.trim() || !email.includes('@')) {
        nextErrors.bankConfirmationEmail = 'Ingresa un correo válido.'
      }
      setErrors(nextErrors)
      if (Object.keys(nextErrors).length) {
        throw new Error('Revisa los datos bancarios ingresados.')
      }
      return graphqlRequest(UpdateOrganisationDocument, {
        input: {
          name: organisation.name,
          phone: organisation.phone,
          businessEmail: organisation.businessEmail,
          timezone: organisation.timezone,
          address: organisation.address,
          description: organisation.description,
          bankName: resolvedBank,
          bankAccountType: accountType,
          bankAccountNumber: accountNumber.replace(/\s/g, ''),
          bankHolderTaxId: formatRutInput(taxId),
          bankConfirmationEmail: email.trim(),
        },
      })
    },
    onSuccess: () => {
      setErrors({})
      onSaved('Guardamos tus datos para depósitos.')
    },
    onError: (saveError: unknown) => {
      if (saveError instanceof TendaApiError && saveError.code === 'VALIDATION_ERROR') {
        setErrors({
          bankName: fieldError(saveError, 'bankName'),
          bankAccountType: fieldError(saveError, 'bankAccountType'),
          bankAccountNumber: fieldError(saveError, 'bankAccountNumber'),
          bankHolderTaxId: fieldError(saveError, 'bankHolderTaxId'),
          bankConfirmationEmail: fieldError(saveError, 'bankConfirmationEmail'),
        })
      }
      onError(
        saveError instanceof TendaApiError
          ? saveError.message
          : 'No pudimos guardar los datos bancarios.',
      )
    },
  })

  return (
    <section className="profile-card profile-card--wide" aria-labelledby="bank-title">
      <div className="profile-card__intro">
        <div className="profile-bank-mark" aria-hidden="true">
          🏦
        </div>
        <div>
          <h2 id="bank-title">Datos para depósitos</h2>
          <p>
            El comprador los verá en el enlace de transferencia. Completa banco, tipo de
            cuenta, número, RUT y correo de confirmación.
          </p>
        </div>
        <span
          className={`profile-bank-status${complete ? ' is-ready' : ''}`}
        >
          {complete ? 'Listo para depósitos' : 'Faltan datos'}
        </span>
      </div>

      <div className="profile-bank-layout">
        <form
          className="profile-form"
          onSubmit={(event) => {
            event.preventDefault()
            if (!canManage) return
            saveBank.mutate()
          }}
        >
          <label className="field" htmlFor="bankName">
            Banco
            <select
              id="bankName"
              value={bankName}
              disabled={!canManage}
              aria-invalid={Boolean(errors.bankName)}
              onChange={(event) => {
                setBankName(event.target.value)
                if (event.target.value !== OTHER_BANK) setCustomBank('')
              }}
            >
              <option value="">Selecciona un banco</option>
              {CHILEAN_BANKS.map((bank) => (
                <option key={bank} value={bank}>
                  {bank}
                </option>
              ))}
              <option value={OTHER_BANK}>{OTHER_BANK}</option>
            </select>
            {errors.bankName ? <span className="field__error">{errors.bankName}</span> : null}
          </label>
          {bankName === OTHER_BANK ? (
            <label className="field" htmlFor="customBank">
              Nombre del banco
              <input
                id="customBank"
                value={customBank}
                disabled={!canManage}
                onChange={(event) => setCustomBank(event.target.value)}
              />
            </label>
          ) : null}
          <label className="field" htmlFor="bankAccountType">
            Tipo de cuenta
            <select
              id="bankAccountType"
              value={accountType}
              disabled={!canManage}
              aria-invalid={Boolean(errors.bankAccountType)}
              onChange={(event) => setAccountType(event.target.value)}
            >
              <option value="">Selecciona el tipo</option>
              {BANK_ACCOUNT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            {errors.bankAccountType ? (
              <span className="field__error">{errors.bankAccountType}</span>
            ) : null}
          </label>
          <label className="field" htmlFor="bankAccountNumber">
            Número de cuenta
            <input
              id="bankAccountNumber"
              inputMode="numeric"
              autoComplete="off"
              value={accountNumber}
              disabled={!canManage}
              aria-invalid={Boolean(errors.bankAccountNumber)}
              onChange={(event) => setAccountNumber(event.target.value.replace(/[^\d\s]/g, ''))}
            />
            {errors.bankAccountNumber ? (
              <span className="field__error">{errors.bankAccountNumber}</span>
            ) : null}
          </label>
          <label className="field" htmlFor="bankHolderTaxId">
            RUT
            <input
              id="bankHolderTaxId"
              autoComplete="off"
              value={taxId}
              disabled={!canManage}
              aria-invalid={Boolean(errors.bankHolderTaxId)}
              onChange={(event) => setTaxId(formatRutInput(event.target.value))}
              placeholder="12.345.678-9"
            />
            {errors.bankHolderTaxId ? (
              <span className="field__error">{errors.bankHolderTaxId}</span>
            ) : null}
          </label>
          <div className="field">
            <label htmlFor="bankConfirmationEmail">Correo electrónico de confirmación</label>
            <input
              id="bankConfirmationEmail"
              type="email"
              autoComplete="email"
              value={email}
              disabled={!canManage}
              aria-invalid={Boolean(errors.bankConfirmationEmail)}
              onChange={(event) => setEmail(event.target.value)}
            />
            <span className="field__hint">
              El comprador lo usará para identificar la transferencia.
            </span>
            {errors.bankConfirmationEmail ? (
              <span className="field__error">{errors.bankConfirmationEmail}</span>
            ) : null}
          </div>
          {canManage ? (
            <button
              className="button button--primary"
              type="submit"
              disabled={saveBank.isPending}
            >
              {saveBank.isPending ? 'Guardando…' : 'Guardar datos bancarios'}
            </button>
          ) : (
            <p className="field__hint">
              Solo quien titula la tienda puede editar los datos para depósitos.
            </p>
          )}
        </form>
        <aside className="profile-bank-preview" aria-label="Vista previa para el comprador">
          <p className="eyebrow">Así lo verá el comprador</p>
          <BankTransferDetails details={preview} compact />
        </aside>
      </div>
    </section>
  )
}
