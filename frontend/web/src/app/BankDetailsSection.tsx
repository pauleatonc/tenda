import {
  BANK_ACCOUNT_TYPES,
  CHILEAN_BANKS,
  MAX_BANK_ACCOUNTS,
  OTHER_BANK,
  ReplaceBankAccountsDocument,
  accountTypeLabel,
  formatRutInput,
  isValidChileanRut,
  organisationHasBankDetails,
  type OrganisationBankAccount,
} from '@tenda/api-client'
import { useMutation } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import type { ViewerPayload } from '../auth/api'
import { TendaApiError, graphqlRequest } from '../lib/http'
import { BankTransferDetails } from '../public/BankTransferDetails'

type FieldErrors = Partial<Record<string, string>>

type DraftAccount = {
  key: string
  label: string
  bankName: string
  customBank: string
  accountType: string
  accountNumber: string
  taxId: string
  email: string
}

function toDraft(
  account: OrganisationBankAccount | undefined,
  fallbackEmail: string,
  index: number,
): DraftAccount {
  const listedBank = CHILEAN_BANKS.includes(
    (account?.bankName ?? '') as (typeof CHILEAN_BANKS)[number],
  )
  return {
    key: account?.id ?? `draft-${index}`,
    label: account?.label || `Cuenta ${index + 1}`,
    bankName: listedBank || !account?.bankName ? (account?.bankName ?? '') : OTHER_BANK,
    customBank: listedBank ? '' : (account?.bankName ?? ''),
    accountType: account?.bankAccountType ?? '',
    accountNumber: account?.bankAccountNumber ?? '',
    taxId: account?.bankHolderTaxId ?? '',
    email: account?.bankConfirmationEmail || fallbackEmail,
  }
}

function accountsFromOrganisation(
  organisation: ViewerPayload['organisation'],
  fallbackEmail: string,
): DraftAccount[] {
  const existing = organisation.bankAccounts ?? []
  if (existing.length) {
    return existing.map((account, index) => toDraft(account, fallbackEmail, index))
  }
  if (organisationHasBankDetails(organisation)) {
    return [
      toDraft(
        {
          id: 'legacy',
          label: 'Cuenta principal',
          bankName: organisation.bankName ?? '',
          bankAccountType: organisation.bankAccountType ?? '',
          bankAccountNumber: organisation.bankAccountNumber ?? '',
          bankHolderTaxId: organisation.bankHolderTaxId ?? '',
          bankConfirmationEmail: organisation.bankConfirmationEmail ?? '',
          position: 0,
        },
        fallbackEmail,
        0,
      ),
    ]
  }
  return [toDraft(undefined, fallbackEmail, 0)]
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
  const fallbackEmail = organisation.bankConfirmationEmail || viewer.viewer.email
  const [accounts, setAccounts] = useState<DraftAccount[]>(() =>
    accountsFromOrganisation(organisation, fallbackEmail),
  )
  const [expandedKey, setExpandedKey] = useState(accounts[0]?.key ?? '')
  const [errors, setErrors] = useState<FieldErrors>({})

  const complete = organisationHasBankDetails({
    hasBankDetails: organisation.hasBankDetails,
    bankAccounts: accounts.map((account, index) => ({
      id: account.key,
      label: account.label,
      bankName: account.bankName === OTHER_BANK ? account.customBank : account.bankName,
      bankAccountType: account.accountType,
      bankAccountNumber: account.accountNumber,
      bankHolderTaxId: account.taxId,
      bankConfirmationEmail: account.email,
      position: index,
    })),
  })

  const previewAccount = accounts.find((account) => account.key === expandedKey) ?? accounts[0]
  const preview = useMemo(() => {
    if (!previewAccount) return null
    const resolvedBank =
      previewAccount.bankName === OTHER_BANK
        ? previewAccount.customBank.trim()
        : previewAccount.bankName
    const ready = organisationHasBankDetails({
      bankName: resolvedBank,
      bankAccountType: previewAccount.accountType,
      bankAccountNumber: previewAccount.accountNumber,
      bankHolderTaxId: previewAccount.taxId,
      bankConfirmationEmail: previewAccount.email,
    })
    if (!ready) return null
    return {
      bankName: resolvedBank,
      accountType: previewAccount.accountType,
      accountTypeLabel: accountTypeLabel(previewAccount.accountType),
      accountNumber: previewAccount.accountNumber.trim(),
      taxId: formatRutInput(previewAccount.taxId),
      confirmationEmail: previewAccount.email.trim(),
    }
  }, [previewAccount])

  function updateAccount(key: string, patch: Partial<DraftAccount>) {
    setAccounts((current) =>
      current.map((account) => (account.key === key ? { ...account, ...patch } : account)),
    )
  }

  function addAccount() {
    if (accounts.length >= MAX_BANK_ACCOUNTS) return
    const next = toDraft(undefined, fallbackEmail, accounts.length)
    setAccounts((current) => [...current, next])
    setExpandedKey(next.key)
  }

  function removeAccount(key: string) {
    setAccounts((current) => {
      const next = current.filter((account) => account.key !== key)
      if (!next.length) return [toDraft(undefined, fallbackEmail, 0)]
      return next.map((account, index) => ({
        ...account,
        label: account.label || `Cuenta ${index + 1}`,
      }))
    })
    setExpandedKey((current) => (current === key ? '' : current))
  }

  const saveBank = useMutation({
    mutationFn: async () => {
      const nextErrors: FieldErrors = {}
      const payload = accounts.map((account, index) => {
        const resolvedBank =
          account.bankName === OTHER_BANK ? account.customBank.trim() : account.bankName
        if (!resolvedBank) nextErrors[`bankAccounts.${index}.bankName`] = 'Indica el banco.'
        if (!account.accountType) {
          nextErrors[`bankAccounts.${index}.bankAccountType`] = 'Selecciona un tipo de cuenta.'
        }
        if (!/^\d{5,20}$/.test(account.accountNumber.replace(/\s/g, ''))) {
          nextErrors[`bankAccounts.${index}.bankAccountNumber`] =
            'Ingresa el número de cuenta, solo dígitos.'
        }
        if (!isValidChileanRut(account.taxId)) {
          nextErrors[`bankAccounts.${index}.bankHolderTaxId`] = 'Ingresa un RUT válido.'
        }
        if (!account.email.trim() || !account.email.includes('@')) {
          nextErrors[`bankAccounts.${index}.bankConfirmationEmail`] = 'Ingresa un correo válido.'
        }
        return {
          label: account.label.trim() || `Cuenta ${index + 1}`,
          bankName: resolvedBank,
          bankAccountType: account.accountType,
          bankAccountNumber: account.accountNumber.replace(/\s/g, ''),
          bankHolderTaxId: formatRutInput(account.taxId),
          bankConfirmationEmail: account.email.trim(),
        }
      })
      setErrors(nextErrors)
      if (Object.keys(nextErrors).length) {
        throw new Error('Revisa los datos bancarios ingresados.')
      }
      return graphqlRequest(ReplaceBankAccountsDocument, {
        input: { accounts: payload },
      })
    },
    onSuccess: () => {
      setErrors({})
      onSaved('Guardamos tus datos para depósitos.')
    },
    onError: (saveError: unknown) => {
      if (saveError instanceof TendaApiError && saveError.code === 'VALIDATION_ERROR') {
        const next: FieldErrors = {}
        for (const [key, messages] of Object.entries(saveError.fieldErrors)) {
          next[key] = messages[0] ?? ''
        }
        setErrors(next)
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
            Puedes registrar hasta {MAX_BANK_ACCOUNTS} cuentas. Al generar una venta por
            depósito elegirás cuál mostrar al comprador.
          </p>
        </div>
        <span className={`profile-bank-status${complete ? ' is-ready' : ''}`}>
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
          <div className="bank-account-list">
            {accounts.map((account, index) => {
              const open = expandedKey === account.key
              return (
                <div
                  key={account.key}
                  className={`bank-account-item${open ? ' is-open' : ''}`}
                >
                  <button
                    type="button"
                    className="bank-account-item__toggle"
                    aria-expanded={open}
                    onClick={() => setExpandedKey(open ? '' : account.key)}
                  >
                    <span>
                      {account.label.trim() || `Cuenta ${index + 1}`}
                      {account.accountNumber
                        ? ` · ${account.bankName === OTHER_BANK ? account.customBank || 'Otro' : account.bankName} ${account.accountNumber}`
                        : ''}
                    </span>
                    <span aria-hidden="true">{open ? '⌃' : '⌄'}</span>
                  </button>
                  {open ? (
                    <div className="bank-account-item__body">
                      <label className="field">
                        Etiqueta
                        <input
                          value={account.label}
                          disabled={!canManage}
                          onChange={(event) =>
                            updateAccount(account.key, { label: event.target.value })
                          }
                          placeholder={`Cuenta ${index + 1}`}
                        />
                      </label>
                      <label className="field">
                        Banco
                        <select
                          value={account.bankName}
                          disabled={!canManage}
                          aria-invalid={Boolean(
                            errors[`bankAccounts.${index}.bankName`],
                          )}
                          onChange={(event) =>
                            updateAccount(account.key, {
                              bankName: event.target.value,
                              customBank:
                                event.target.value === OTHER_BANK ? account.customBank : '',
                            })
                          }
                        >
                          <option value="">Selecciona un banco</option>
                          {CHILEAN_BANKS.map((bank) => (
                            <option key={bank} value={bank}>
                              {bank}
                            </option>
                          ))}
                          <option value={OTHER_BANK}>{OTHER_BANK}</option>
                        </select>
                        {errors[`bankAccounts.${index}.bankName`] ? (
                          <span className="field__error">
                            {errors[`bankAccounts.${index}.bankName`]}
                          </span>
                        ) : null}
                      </label>
                      {account.bankName === OTHER_BANK ? (
                        <label className="field">
                          Nombre del banco
                          <input
                            value={account.customBank}
                            disabled={!canManage}
                            onChange={(event) =>
                              updateAccount(account.key, { customBank: event.target.value })
                            }
                          />
                        </label>
                      ) : null}
                      <label className="field">
                        Tipo de cuenta
                        <select
                          value={account.accountType}
                          disabled={!canManage}
                          aria-invalid={Boolean(
                            errors[`bankAccounts.${index}.bankAccountType`],
                          )}
                          onChange={(event) =>
                            updateAccount(account.key, { accountType: event.target.value })
                          }
                        >
                          <option value="">Selecciona el tipo</option>
                          {BANK_ACCOUNT_TYPES.map((type) => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                        {errors[`bankAccounts.${index}.bankAccountType`] ? (
                          <span className="field__error">
                            {errors[`bankAccounts.${index}.bankAccountType`]}
                          </span>
                        ) : null}
                      </label>
                      <label className="field">
                        Número de cuenta
                        <input
                          inputMode="numeric"
                          autoComplete="off"
                          value={account.accountNumber}
                          disabled={!canManage}
                          aria-invalid={Boolean(
                            errors[`bankAccounts.${index}.bankAccountNumber`],
                          )}
                          onChange={(event) =>
                            updateAccount(account.key, {
                              accountNumber: event.target.value.replace(/[^\d\s]/g, ''),
                            })
                          }
                        />
                        {errors[`bankAccounts.${index}.bankAccountNumber`] ? (
                          <span className="field__error">
                            {errors[`bankAccounts.${index}.bankAccountNumber`]}
                          </span>
                        ) : null}
                      </label>
                      <label className="field">
                        RUT
                        <input
                          autoComplete="off"
                          value={account.taxId}
                          disabled={!canManage}
                          aria-invalid={Boolean(
                            errors[`bankAccounts.${index}.bankHolderTaxId`],
                          )}
                          onChange={(event) =>
                            updateAccount(account.key, {
                              taxId: formatRutInput(event.target.value),
                            })
                          }
                          placeholder="12.345.678-9"
                        />
                        {errors[`bankAccounts.${index}.bankHolderTaxId`] ? (
                          <span className="field__error">
                            {errors[`bankAccounts.${index}.bankHolderTaxId`]}
                          </span>
                        ) : null}
                      </label>
                      <div className="field">
                        <label>Correo electrónico de confirmación</label>
                        <input
                          type="email"
                          autoComplete="email"
                          value={account.email}
                          disabled={!canManage}
                          aria-invalid={Boolean(
                            errors[`bankAccounts.${index}.bankConfirmationEmail`],
                          )}
                          onChange={(event) =>
                            updateAccount(account.key, { email: event.target.value })
                          }
                        />
                        <span className="field__hint">
                          El comprador lo usará para identificar la transferencia.
                        </span>
                        {errors[`bankAccounts.${index}.bankConfirmationEmail`] ? (
                          <span className="field__error">
                            {errors[`bankAccounts.${index}.bankConfirmationEmail`]}
                          </span>
                        ) : null}
                      </div>
                      {canManage && accounts.length > 1 ? (
                        <button
                          type="button"
                          className="button button--secondary button--compact"
                          onClick={() => removeAccount(account.key)}
                        >
                          Eliminar cuenta
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>

          {canManage ? (
            <div className="bank-account-actions">
              {accounts.length < MAX_BANK_ACCOUNTS ? (
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={addAccount}
                >
                  Agregar cuenta
                </button>
              ) : null}
              <button
                className="button button--primary"
                type="submit"
                disabled={saveBank.isPending}
              >
                {saveBank.isPending ? 'Guardando…' : 'Guardar datos bancarios'}
              </button>
            </div>
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
