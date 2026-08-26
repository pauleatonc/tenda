import { AppScreen, MobileEmptyState, MobileStatusChip } from './app-ui'

export function ComingSoonScreen({
  title,
  description,
  stage,
}: {
  title: string
  description: string
  stage: string
}) {
  return (
    <AppScreen title={title} eyebrow={stage}>
      <MobileEmptyState
        title={`${title} está preparado`}
        description={description}
        action={<MobileStatusChip label="Próximamente" tone="warning" />}
      />
    </AppScreen>
  )
}
