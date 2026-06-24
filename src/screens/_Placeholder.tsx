import { Screen, PageHeader, ScreenBody } from '@/components/ui/screen'

/** Temporary placeholder until the screen is implemented. */
export function Placeholder({ name, breadcrumb }: { name: string; breadcrumb: string }) {
  return (
    <Screen>
      <PageHeader breadcrumb={breadcrumb} title={name} />
      <ScreenBody>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '70%', minHeight: 320, color: 'var(--placeholder)', gap: 12 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: 'var(--jade-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🚧</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-2)' }}>{name}</div>
          <div style={{ fontSize: 12.5 }}>Đang được dựng…</div>
        </div>
      </ScreenBody>
    </Screen>
  )
}
