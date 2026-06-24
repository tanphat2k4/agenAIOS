import { useStore } from '@/store'

/** Global toast — ported from the prototype's showGlobalToast. */
export function Toast() {
  const toast = useStore((s) => s.toast)
  if (!toast) return null
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 26,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 120,
        background: 'var(--ink)',
        color: '#fff',
        fontSize: 13,
        fontWeight: 600,
        padding: '12px 20px',
        borderRadius: 99,
        boxShadow: '0 10px 30px rgba(22,32,28,.3)',
        animation: 'pop .2s ease both',
      }}
    >
      {toast}
    </div>
  )
}
