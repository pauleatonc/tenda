import {
  BANK_ACCOUNT_TYPES,
  CHILEAN_BANKS,
  MAX_BANK_ACCOUNTS,
  OTHER_BANK,
  formatRutInput,
  isValidChileanRut,
  organisationHasBankDetails,
  type OrganisationBankAccount,
} from '@tenda/api-client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { AppScreen } from '../../../components/app-ui'
import { AuthImage } from '../../../components/auth-image'
import {
  FormField,
  PrimaryButton,
  StatusMessage,
  colors,
} from '../../../components/auth-ui'
import { OptionRow, Sheet } from '../../../components/inventory-ui'
import { AnalyticsEvents, getAnalytics, markActivationFlag } from '../../../lib/analytics'
import { MobileApiError, getMobileViewer, getStoredToken } from '../../../lib/auth-api'
import {
  replaceMobileBankAccounts,
  updateMobileOrganisation,
  updateMobileProfile,
} from '../../../lib/profile-api'
import { pickProductImage, uploadPrivateImage } from '../../../lib/mobile-upload'

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

export default function ProfileScreen() {
  const queryClient = useQueryClient()
  const viewer = useQuery({
    queryKey: ['mobile-viewer'],
    queryFn: getMobileViewer,
    retry: false,
  })
  const data = viewer.data
  const canManageStore =
    data?.membership.permissions.manageSensitiveConfiguration === true
  const [fullName, setFullName] = useState(data?.viewer.profile.fullName ?? '')
  const [phone, setPhone] = useState(data?.viewer.profile.phone ?? '')
  const [storeName, setStoreName] = useState(data?.organisation.name ?? '')
  const [address, setAddress] = useState(data?.organisation.address ?? '')
  const [description, setDescription] = useState(data?.organisation.description ?? '')
  const fallbackEmail =
    data?.organisation.bankConfirmationEmail || data?.viewer.email || ''
  const [accounts, setAccounts] = useState<DraftAccount[]>([
    toDraft(undefined, fallbackEmail, 0),
  ])
  const [expandedKey, setExpandedKey] = useState(accounts[0]?.key ?? '')
  const [bankPickerFor, setBankPickerFor] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!data) return
    setFullName(data.viewer.profile.fullName)
    setPhone(data.viewer.profile.phone)
    setStoreName(data.organisation.name)
    setAddress(data.organisation.address)
    setDescription(data.organisation.description)
    const email = data.organisation.bankConfirmationEmail || data.viewer.email
    const existing = data.organisation.bankAccounts ?? []
    const next =
      existing.length > 0
        ? existing.map((account, index) => toDraft(account, email, index))
        : organisationHasBankDetails(data.organisation)
          ? [
              toDraft(
                {
                  id: 'legacy',
                  label: 'Cuenta principal',
                  bankName: data.organisation.bankName ?? '',
                  bankAccountType: data.organisation.bankAccountType ?? '',
                  bankAccountNumber: data.organisation.bankAccountNumber ?? '',
                  bankHolderTaxId: data.organisation.bankHolderTaxId ?? '',
                  bankConfirmationEmail: data.organisation.bankConfirmationEmail ?? '',
                  position: 0,
                },
                email,
                0,
              ),
            ]
          : [toDraft(undefined, email, 0)]
    setAccounts(next)
    setExpandedKey(next[0]?.key ?? '')
  }, [data])

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ['mobile-viewer'] })
  }

  function updateAccount(key: string, patch: Partial<DraftAccount>) {
    setAccounts((current) =>
      current.map((account) =>
        account.key === key ? { ...account, ...patch } : account,
      ),
    )
  }

  const saveProfile = useMutation({
    mutationFn: (photoAssetId?: string) =>
      updateMobileProfile({ fullName, phone, photoAssetId }),
    onSuccess: () => {
      setMessage('Guardamos tu perfil.')
      setError('')
      refresh()
    },
    onError: (saveError: unknown) => {
      setError(
        saveError instanceof MobileApiError
          ? saveError.message
          : 'No pudimos guardar tu perfil.',
      )
    },
  })

  const saveStore = useMutation({
    mutationFn: (logoAssetId?: string) =>
      updateMobileOrganisation({
        name: storeName,
        phone: data?.organisation.phone ?? '',
        businessEmail: data?.organisation.businessEmail ?? '',
        timezone: data?.organisation.timezone ?? 'America/Santiago',
        address,
        description,
        logoAssetId,
      }),
    onSuccess: () => {
      setMessage('Guardamos los datos de la tienda.')
      setError('')
      refresh()
    },
    onError: (saveError: unknown) => {
      setError(
        saveError instanceof MobileApiError
          ? saveError.message
          : 'No pudimos guardar la tienda.',
      )
    },
  })

  const bankComplete = organisationHasBankDetails({
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

  const saveBank = useMutation({
    mutationFn: () => {
      const payload = accounts.map((account, index) => {
        const resolvedBank =
          account.bankName === OTHER_BANK ? account.customBank.trim() : account.bankName
        if (
          !resolvedBank ||
          !account.accountType ||
          !/^\d{5,20}$/.test(account.accountNumber.replace(/\s/g, '')) ||
          !isValidChileanRut(account.taxId) ||
          !account.email.includes('@')
        ) {
          throw new Error('Revisa los datos bancarios ingresados.')
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
      return replaceMobileBankAccounts(payload)
    },
    onSuccess: () => {
      setMessage('Guardamos tus datos para depósitos.')
      setError('')
      getAnalytics().track(AnalyticsEvents.bankDetailsSaved, {
        account_count: accounts.length,
      })
      void markActivationFlag('payments')
      refresh()
    },
    onError: (saveError: unknown) => {
      setError(
        saveError instanceof MobileApiError
          ? saveError.message
          : saveError instanceof Error
            ? saveError.message
            : 'No pudimos guardar los datos bancarios.',
      )
    },
  })

  async function uploadPhoto() {
    try {
      const image = await pickProductImage()
      if (!image) return
      const assetId = await uploadPrivateImage(image, 'profile_photo')
      saveProfile.mutate(assetId)
    } catch (uploadError) {
      setError(
        uploadError instanceof MobileApiError
          ? uploadError.message
          : 'No pudimos cargar tu foto.',
      )
    }
  }

  async function uploadLogo() {
    try {
      const image = await pickProductImage()
      if (!image) return
      const assetId = await uploadPrivateImage(image, 'organisation_logo')
      saveStore.mutate(assetId)
    } catch (uploadError) {
      setError(
        uploadError instanceof MobileApiError
          ? uploadError.message
          : 'No pudimos cargar el logo.',
      )
    }
  }

  return (
    <AppScreen title="Perfil y negocio" eyebrow="Cuenta">
      {message ? <StatusMessage kind="success" message={message} /> : null}
      {error ? <StatusMessage kind="error" message={error} /> : null}

      <View style={styles.card}>
        <Text style={styles.section}>Tu perfil</Text>
        <Text style={styles.role}>{data?.membership.roleLabel ?? ''}</Text>
        <View style={styles.photoRow}>
          <View style={styles.avatar}>
            <Text style={styles.initial}>
              {(data?.viewer.profile.fullName || data?.viewer.email || '?')
                .slice(0, 1)
                .toUpperCase()}
            </Text>
            {data?.viewer.profile.photoUrl ? (
              <AuthImage uri={data.viewer.profile.photoUrl} style={styles.photo} />
            ) : null}
          </View>
          <Pressable accessibilityRole="button" onPress={() => void uploadPhoto()}>
            <Text style={styles.link}>Cambiar foto</Text>
          </Pressable>
        </View>
        <FormField label="Correo" value={data?.viewer.email ?? ''} editable={false} />
        <FormField label="Nombre" value={fullName} onChangeText={setFullName} />
        <FormField
          label="Teléfono"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        <PrimaryButton
          label={saveProfile.isPending ? 'Guardando…' : 'Guardar perfil'}
          onPress={() => saveProfile.mutate(undefined)}
        />
      </View>

      <View style={[styles.card, styles.storeCard]}>
        <Text style={styles.section}>Tu tienda</Text>
        <View style={styles.photoRow}>
          <View style={[styles.avatar, styles.logo]}>
            <Text style={styles.initial}>
              {(data?.organisation.name || 'T').slice(0, 1).toUpperCase()}
            </Text>
            {data?.organisation.logoUrl ? (
              <AuthImage uri={data.organisation.logoUrl} style={styles.photo} />
            ) : null}
          </View>
          {canManageStore ? (
            <Pressable accessibilityRole="button" onPress={() => void uploadLogo()}>
              <Text style={styles.link}>Cambiar logo</Text>
            </Pressable>
          ) : null}
        </View>
        <FormField
          label="Nombre de la tienda"
          value={storeName}
          onChangeText={setStoreName}
          editable={canManageStore}
        />
        <FormField
          label="Dirección"
          value={address}
          onChangeText={setAddress}
          editable={canManageStore}
        />
        <FormField
          label="Descripción"
          value={description}
          onChangeText={setDescription}
          editable={canManageStore}
          multiline
        />
        {canManageStore ? (
          <PrimaryButton
            label={saveStore.isPending ? 'Guardando…' : 'Guardar tienda'}
            onPress={() => saveStore.mutate(undefined)}
          />
        ) : (
          <Text style={styles.hint}>
            Solo quien titula la tienda puede editar estos datos.
          </Text>
        )}
      </View>

      <View style={[styles.card, styles.storeCard]}>
        <Text style={styles.section}>Datos para depósitos</Text>
        <Text style={styles.hint}>
          Hasta {MAX_BANK_ACCOUNTS} cuentas. Al generar una venta por depósito eliges cuál
          mostrar.
        </Text>
        <Text style={bankComplete ? styles.ready : styles.pending}>
          {bankComplete ? 'Listo para depósitos' : 'Faltan datos'}
        </Text>

        {accounts.map((account, index) => {
          const open = expandedKey === account.key
          return (
            <View key={account.key} style={styles.accountCard}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                onPress={() => setExpandedKey(open ? '' : account.key)}
              >
                <Text style={styles.accountToggle}>
                  {account.label.trim() || `Cuenta ${index + 1}`}
                  {open ? '  ⌃' : '  ⌄'}
                </Text>
              </Pressable>
              {open ? (
                <View style={styles.accountBody}>
                  <FormField
                    label="Etiqueta"
                    value={account.label}
                    onChangeText={(value) => updateAccount(account.key, { label: value })}
                    editable={canManageStore}
                  />
                  <Pressable
                    accessibilityRole="button"
                    disabled={!canManageStore}
                    onPress={() => setBankPickerFor(account.key)}
                  >
                    <FormField
                      label="Banco"
                      value={
                        account.bankName === OTHER_BANK
                          ? account.customBank || 'Otro'
                          : account.bankName
                      }
                      editable={false}
                      placeholder="Selecciona un banco"
                    />
                  </Pressable>
                  {account.bankName === OTHER_BANK ? (
                    <FormField
                      label="Nombre del banco"
                      value={account.customBank}
                      onChangeText={(value) =>
                        updateAccount(account.key, { customBank: value })
                      }
                      editable={canManageStore}
                    />
                  ) : null}
                  <OptionRow
                    label="Tipo de cuenta"
                    value={account.accountType}
                    onChange={(value) =>
                      updateAccount(account.key, { accountType: value })
                    }
                    options={BANK_ACCOUNT_TYPES.map((type) => ({
                      value: type.value,
                      label: type.label,
                      disabled: !canManageStore,
                    }))}
                  />
                  <FormField
                    label="Número de cuenta"
                    value={account.accountNumber}
                    onChangeText={(value) =>
                      updateAccount(account.key, {
                        accountNumber: value.replace(/[^\d\s]/g, ''),
                      })
                    }
                    keyboardType="number-pad"
                    editable={canManageStore}
                  />
                  <FormField
                    label="RUT"
                    value={account.taxId}
                    onChangeText={(value) =>
                      updateAccount(account.key, { taxId: formatRutInput(value) })
                    }
                    editable={canManageStore}
                  />
                  <FormField
                    label="Correo de confirmación"
                    value={account.email}
                    onChangeText={(value) => updateAccount(account.key, { email: value })}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={canManageStore}
                  />
                  {canManageStore && accounts.length > 1 ? (
                    <PrimaryButton
                      label="Eliminar cuenta"
                      variant="secondary"
                      onPress={() => {
                        setAccounts((current) => {
                          const next = current.filter((item) => item.key !== account.key)
                          return next.length
                            ? next
                            : [toDraft(undefined, fallbackEmail, 0)]
                        })
                        setExpandedKey('')
                      }}
                    />
                  ) : null}
                </View>
              ) : null}
            </View>
          )
        })}

        {canManageStore ? (
          <>
            {accounts.length < MAX_BANK_ACCOUNTS ? (
              <PrimaryButton
                label="Agregar cuenta"
                variant="secondary"
                onPress={() => {
                  const next = toDraft(undefined, fallbackEmail, accounts.length)
                  setAccounts((current) => [...current, next])
                  setExpandedKey(next.key)
                }}
              />
            ) : null}
            <PrimaryButton
              label={saveBank.isPending ? 'Guardando…' : 'Guardar datos bancarios'}
              onPress={() => saveBank.mutate()}
            />
          </>
        ) : (
          <Text style={styles.hint}>
            Solo quien titula la tienda puede editar los datos para depósitos.
          </Text>
        )}
      </View>

      <Sheet
        visible={Boolean(bankPickerFor)}
        title="Banco"
        onClose={() => setBankPickerFor(null)}
      >
        {CHILEAN_BANKS.map((bank) => (
          <Pressable
            key={bank}
            accessibilityRole="button"
            onPress={() => {
              if (bankPickerFor) {
                updateAccount(bankPickerFor, { bankName: bank, customBank: '' })
              }
              setBankPickerFor(null)
            }}
          >
            <Text style={styles.bankOption}>{bank}</Text>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            if (bankPickerFor) updateAccount(bankPickerFor, { bankName: OTHER_BANK })
            setBankPickerFor(null)
          }}
        >
          <Text style={styles.bankOption}>{OTHER_BANK}</Text>
        </Pressable>
      </Sheet>
    </AppScreen>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 18,
  },
  section: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  role: { color: colors.inkSoft, marginTop: -6, textTransform: 'capitalize' },
  photoRow: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.greenPale,
    borderRadius: 36,
    height: 64,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 64,
  },
  logo: { borderRadius: 16 },
  photo: { height: 64, position: 'absolute', width: 64 },
  initial: { color: colors.green, fontSize: 22, fontWeight: '800' },
  link: { color: colors.green, fontWeight: '800' },
  hint: { color: colors.inkSoft, fontSize: 13, lineHeight: 19 },
  storeCard: { marginTop: 16 },
  ready: { color: colors.green, fontWeight: '800' },
  pending: { color: '#8a6d14', fontWeight: '800' },
  accountCard: {
    borderColor: colors.line,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  accountToggle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '800',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  accountBody: { borderTopColor: colors.line, borderTopWidth: 1, gap: 12, padding: 14 },
  bankOption: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
    paddingVertical: 12,
  },
})
