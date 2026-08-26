import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native'

import {
  attachProductMedia,
  inventoryKeys,
  removeProductMedia,
  setPrimaryProductMedia,
  type ProductMedia,
} from '../lib/inventory-api'
import {
  pickProductImage,
  uploadProductImage,
  type PickedImage,
} from '../lib/mobile-upload'
import { PrimaryButton, colors } from './auth-ui'
import { SectionCard } from './inventory-ui'

export function MobileProductMedia({
  productId,
  media,
  archived,
}: {
  productId: string
  media: ProductMedia[]
  archived: boolean
}) {
  const queryClient = useQueryClient()
  const [progress, setProgress] = useState<number | null>(null)
  const [failedImage, setFailedImage] = useState<PickedImage | null>(null)
  const [error, setError] = useState('')
  const lastImage = useRef<PickedImage | null>(null)

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: inventoryKeys.product(productId) })
  }

  const upload = useMutation({
    mutationFn: async (retryImage?: PickedImage) => {
      setError('')
      const image = retryImage ?? (await pickProductImage())
      if (!image) return null
      lastImage.current = image
      setFailedImage(null)
      setProgress(0)
      const assetId = await uploadProductImage(image, setProgress)
      await attachProductMedia(productId, assetId, media.length === 0)
      return image
    },
    onSuccess: (image) => {
      setProgress(null)
      if (image) refresh()
    },
    onError: (uploadError: unknown) => {
      setProgress(null)
      setFailedImage(lastImage.current)
      setError(
        uploadError instanceof Error ? uploadError.message : 'No pudimos cargar la foto.',
      )
    },
  })

  const primary = useMutation({
    mutationFn: (assetId: string) => setPrimaryProductMedia(productId, assetId),
    onSuccess: refresh,
    onError: (actionError: unknown) =>
      setError(
        actionError instanceof Error
          ? actionError.message
          : 'No pudimos cambiar la foto principal.',
      ),
  })

  const remove = useMutation({
    mutationFn: (assetId: string) => removeProductMedia(productId, assetId),
    onSuccess: refresh,
    onError: (actionError: unknown) =>
      setError(
        actionError instanceof Error ? actionError.message : 'No pudimos eliminar la foto.',
      ),
  })

  return (
    <SectionCard title="Fotos">
      <Text style={styles.help}>Galería privada del producto. Máximo 10 imágenes.</Text>
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      ) : null}
      {progress !== null ? (
        <Text accessibilityLiveRegion="polite" style={styles.progress}>
          Cargando foto: {progress}%
        </Text>
      ) : null}
      {media.length ? (
        <View style={styles.gallery}>
          {[...media]
            .sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary))
            .map((item) => (
              <View key={item.assetId} style={styles.card}>
                <Image
                  accessibilityLabel={item.originalName}
                  source={{ uri: item.url }}
                  style={styles.image}
                />
                <Text style={styles.name}>
                  {item.isPrimary ? 'Foto principal' : item.originalName}
                </Text>
                <View style={styles.actions}>
                  {!item.isPrimary ? (
                    <Pressable
                      accessibilityRole="button"
                      disabled={primary.isPending}
                      onPress={() => primary.mutate(item.assetId)}
                    >
                      <Text style={styles.link}>Usar como principal</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    disabled={remove.isPending}
                    onPress={() =>
                      Alert.alert(
                        'Eliminar foto',
                        'La imagen dejará de estar disponible para este producto.',
                        [
                          { text: 'Cancelar', style: 'cancel' },
                          {
                            text: 'Eliminar',
                            style: 'destructive',
                            onPress: () => remove.mutate(item.assetId),
                          },
                        ],
                      )
                    }
                  >
                    <Text style={styles.delete}>Eliminar</Text>
                  </Pressable>
                </View>
              </View>
            ))}
        </View>
      ) : (
        <Text style={styles.help}>Este producto todavía no tiene fotos.</Text>
      )}
      {!archived ? (
        <PrimaryButton
          label={upload.isPending ? 'Cargando foto…' : 'Agregar foto'}
          variant="secondary"
          loading={upload.isPending}
          onPress={() => upload.mutate(undefined)}
        />
      ) : null}
      {failedImage ? (
        <PrimaryButton
          label="Reintentar carga"
          variant="secondary"
          onPress={() => upload.mutate(failedImage)}
        />
      ) : null}
    </SectionCard>
  )
}

const styles = StyleSheet.create({
  help: { color: colors.inkSoft, fontSize: 13, lineHeight: 19 },
  error: { color: colors.error, fontSize: 13, lineHeight: 19 },
  progress: { color: colors.green, fontSize: 14, fontWeight: '700' },
  gallery: { gap: 12 },
  card: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
    overflow: 'hidden',
    paddingBottom: 12,
  },
  image: { aspectRatio: 4 / 3, backgroundColor: colors.line, width: '100%' },
  name: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
    paddingHorizontal: 12,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    paddingHorizontal: 12,
  },
  link: { color: colors.green, fontSize: 13, fontWeight: '700' },
  delete: { color: colors.error, fontSize: 13, fontWeight: '700' },
})
