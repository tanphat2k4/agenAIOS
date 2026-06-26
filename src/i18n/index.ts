// Lightweight i18n retrofit. Vietnamese is the source of truth: every UI string
// stays written in Vietnamese in the JSX, wrapped in t(). When the active
// language is not 'vi', t() looks the string up in that language's dictionary;
// a missing key falls back to the Vietnamese text so partial coverage is safe.
import { useStore } from '@/store'
import { EN } from './en'

const DICT: Record<string, Record<string, string>> = {
  en: EN,
  // zh / ja / ko dictionaries added in later phases
}

export function translate(lang: string, vi: string): string {
  if (lang === 'vi') return vi
  return DICT[lang]?.[vi] ?? vi
}

/** Hook returning a `t(viString)` translator bound to the active UI language.
 *  Subscribes to activeLang so components re-render when the language changes. */
export function useT(): (vi: string) => string {
  const lang = useStore((s) => s.activeLang)
  return (vi: string) => translate(lang, vi)
}
