import {
  BANK_ACCOUNT_TYPES,
  CHILEAN_BANKS,
  OTHER_BANK,
  formatRutInput,
  isValidChileanRut,
  organisationHasBankDetails,
} from '@tenda/api-client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'

import { AppScreen } from '../../../components/app-ui'
import { FormField, PrimaryButton, StatusMessage, colors } from '../../../components/auth-ui'
import { OptionRow, Sheet } from '../../../components/inventory-ui'
import { MobileApiError, getMobileViewer, getStoredToken } from '../../../lib/auth-api'
import { updateMobileOrganisation, updateMobileProfile } from '../../../lib/profile-api'
import { pickProductImage, uploadPrivateImage } from '../../../lib/mobile-upload'

function AuthImage({ uri, style }: { uri: string | null; style: object }) {
  const [headers, setHeaders] = useState<Record<string, string>>({})
  useEffect(() => {
    void getStoredToken().then((token) => {
      if (token) setHeaders({ Authorization: `Bearer ${token}` })
    })
  }, [])
  if (!uri || !headers.Authorization) return null
  return <Image source={{ uri, headers }} style={style} />
}

export default function ProfileScreen() {
  const queryClient = useQueryClient()
  const viewer = useQuery({
    queryKey: ['mobile-viewer'],
    queryFn: getMobileViewer,
    retry: false,
  })
  const data = viewer.data
  const canManageStore = data?.membership.permissions.manageSensitiveConfiguration === true
  const [fullName, setFullName] = useState(data?.viewer.profile.fullName ?? '')
  const [phone, setPhone] = useState(data?.viewer.profile.phone ?? '')
  const [storeName, setStoreName] = useState(data?.organisation.name ?? '')
  const [address, setAddress] = useState(data?.organisation.address ?? '')
  const [description, setDescription] = useState(data?.organisation.description ?? '')
  const listedBank = CHILEAN_BANKS.includes(
    (data?.organisation.bankName ?? '') as (typeof CHILEAN_BANKS)[number],
  )
  const [bankName, setBankName] = useState(
    listedBank || !data?.organisation.bankName
      ? (data?.organisation.bankName ?? '')
      : OTHER_BANK,
  )
  const [customBank, setCustomBank] = useState(
    listedBank ? '' : (data?.organisation.bankName ?? ''),
  )
  const [accountType, setAccountType] = useState(data?.organisation.bankAccountType ?? '')
  const [accountNumber, setAccountNumber] = useState(
    data?.organisation.bankAccountNumber ?? '',
  )
  const [taxId, setTaxId] = useState(data?.organisation.bankHolderTaxId ?? '')
  const [email, setEmail] = useState(
    data?.organisation.bankConfirmationEmail || data?.viewer.email || '',
  )
  const [bankPickerOpen, setBankPickerOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!data) return
    setFullName(data.viewer.profile.fullName)
    setPhone(data.viewer.profile.phone)
    setStoreName(data.organisation.name)
    setAddress(data.organisation.address)
    setDescription(data.organisation.description)
    const knownBank = CHILEAN_BANKS.includes(
      (data.organisation.bankName ?? '') as (typeof CHILEAN_BANKS)[number],
    )
    setBankName(
      knownBank || !data.organisation.bankName
        ? (data.organisation.bankName ?? '')
        : OTHER_BANK,
    )
    setCustomBank(knownBank ? '' : (data.organisation.bankName ?? ''))
    setAccountType(data.organisation.bankAccountType ?? '')
    setAccountNumber(data.organisation.bankAccountNumber ?? '')
    setTaxId(data.organisation.bankHolderTaxId ?? '')
    setEmail(data.organisation.bankConfirmationEmail || data.viewer.email)
  }, [data])

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ['mobile-viewer'] })
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
        saveError instanceof MobileApiError ? saveError.message : 'No pudimos guardar tu perfil.',
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
        saveError instanceof MobileApiError ? saveError.message : 'No pudimos guardar la tienda.',
      )
    },
  })

  const resolvedBank = bankName === OTHER_BANK ? customBank.trim() : bankName
  const bankComplete = organisationHasBankDetails({
    bankName: resolvedBank,
    bankAccountType: accountType,
    bankAccountNumber: accountNumber,
    bankHolderTaxId: taxId,
    bankConfirmationEmail: email,
  })

  const saveBank = useMutation({
    mutationFn: () => {
      if (!resolvedBank || !accountType || !/^\d{5,20}$/.test(accountNumber.replace(/\s/g, ''))) {
        throw new Error('Revisa los datos bancarios ingresados.')
      }
      if (!isValidChileanRut(taxId) || !email.includes('@')) {
        throw new Error('Revisa los datos bancarios ingresados.')
      }
      return updateMobileOrganisation({
        name: data?.organisation.name ?? storeName,
        phone: data?.organisation.phone ?? '',
        businessEmail: data?.organisation.businessEmail ?? '',
        timezone: data?.organisation.timezone ?? 'America/Santiago',
        address: data?.organisation.address ?? address,
        description: data?.organisation.description ?? description,
        bankName: resolvedBank,
        bankAccountType: accountType,
        bankAccountNumber: accountNumber.replace(/\s/g, ''),
        bankHolderTaxId: formatRutInput(taxId),
        bankConfirmationEmail: email.trim(),
      })
    },
    onSuccess: () => {
      setMessage('Guardamos tus datos para depósitos.')
      setError('')
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
        <FormField label="Teléfono" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
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
          <Text style={styles.hint}>Solo quien titula la tienda puede editar estos datos.</Text>
        )}
      </View>

      <View style={[styles.card, styles.storeCard]}>
        <Text style={styles.section}>Datos para depósitos</Text>
        <Text style={styles.hint}>
          El comprador los verá al transferir. Completa banco, tipo de cuenta, número, RUT
          y correo de confirmación.
        </Text>
        <Text style={bankComplete ? styles.ready : styles.pending}>
          {bankComplete ? 'Listo para depósitos' : 'Faltan datos'}
        </Text>
        <Pressable
          accessibilityRole="button"
          disabled={!canManageStore}
          onPress={() => setBankPickerOpen(true)}
        >
          <FormField
            label="Banco"
            value={bankName === OTHER_BANK ? customBank || 'Otro' : bankName}
            editable={false}
            placeholder="Selecciona un banco"
          />
        </Pressable>
        {bankName === OTHER_BANK ? (
          <FormField
            label="Nombre del banco"
            value={customBank}
            onChangeText={setCustomBank}
            editable={canManageStore}
          />
        ) : null}
        <OptionRow
          label="Tipo de cuenta"
          value={accountType}
          onChange={setAccountType}
          options={BANK_ACCOUNT_TYPES.map((type) => ({
            value: type.value,
            label: type.label,
            disabled: !canManageStore,
          }))}
        />
        <FormField
          label="Número de cuenta"
          value={accountNumber}
          onChangeText={(value) => setAccountNumber(value.replace(/[^\d\s]/g, ''))}
          keyboardType="number-pad"
          editable={canManageStore}
        />
        <FormField
          label="RUT"
          value={taxId}
          onChangeText={(value) => setTaxId(formatRutInput(value))}
          editable={canManageStore}
        />
        <FormField
          label="Correo de confirmación"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={canManageStore}
        />
        {canManageStore ? (
          <PrimaryButton
            label={saveBank.isPending ? 'Guardando…' : 'Guardar datos bancarios'}
            onPress={() => saveBank.mutate()}
          />
        ) : (
          <Text style={styles.hint}>
            Solo quien titula la tienda puede editar los datos para depósitos.
          </Text>
        )}
      </View>

      <Sheet
        visible={bankPickerOpen}
        title="Banco"
        onClose={() => setBankPickerOpen(false)}
      >
        {CHILEAN_BANKS.map((bank) => (
          <Pressable
            key={bank}
            accessibilityRole="button"
            onPress={() => {
              setBankName(bank)
              setCustomBank('')
              setBankPickerOpen(false)
            }}
          >
            <Text style={styles.bankOption}>{bank}</Text>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setBankName(OTHER_BANK)
            setBankPickerOpen(false)
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
  bankOption: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
    paddingVertical: 12,
  },
})
