// Rich-text span helpers — ported from the prototype's t/c/b/m/a/lk constructors.
export interface RichSpan {
  v: string
  isText?: boolean
  isCode?: boolean
  isBold?: boolean
  isMention?: boolean
  isAmber?: boolean
  isLink?: boolean
}
export const t = (v: string): RichSpan => ({ v, isText: true })
export const c = (v: string): RichSpan => ({ v, isCode: true })
export const b = (v: string): RichSpan => ({ v, isBold: true })
export const m = (v: string): RichSpan => ({ v, isMention: true })
export const a = (v: string): RichSpan => ({ v, isAmber: true })
export const lk = (v: string): RichSpan => ({ v, isLink: true })

export type MsgBlock =
  | { kind: 'para'; rich: RichSpan[] }
  | { kind: 'list'; items: RichSpan[][] }
  | { kind: 'task'; code: string; text: string }
  | { kind: 'attach'; icon: string; name: string; label: string; url?: string; mime?: string; fileKind?: string }
  | { kind: 'table'; rows: string[][] }

export interface ChatMessage {
  authorName: string
  time: string
  avatarInitial: string
  avatarColor: string
  isAgent: boolean
  replyable?: boolean
  raw: MsgBlock[]
}
