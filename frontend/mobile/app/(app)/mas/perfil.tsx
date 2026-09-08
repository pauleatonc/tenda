import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'

import { AppScreen } from '../../../components/app-ui'
import { FormField, PrimaryButton, StatusMessage, colors } from '../../../components/auth-ui'
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
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!data) return
    setFullName(data.viewer.profile.fullName)
    setPhone(data.viewer.profile.phone)
    setStoreName(data.organisation.name)
    setAddress(data.organisation.address)
    setDescription(data.organisation.description)
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
  hint: { color: colors.inkSoft, fontSize: 13 },
  storeCard: { marginTop: 16 },
})
