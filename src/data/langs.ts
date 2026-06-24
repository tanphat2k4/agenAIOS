export interface LangDef { code: string; label: string; native: string; flag: string }
export const LANGS: LangDef[] = [
  { code: 'vi', label: 'Tiếng Việt', native: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'en', label: 'English', native: 'English', flag: '🇬🇧' },
  { code: 'ja', label: '日本語', native: '日本語', flag: '🇯🇵' },
  { code: 'zh', label: '中文', native: '中文', flag: '🇨🇳' },
  { code: 'ko', label: '한국어', native: '한국어', flag: '🇰🇷' },
]
export const langLabel = (code: string) => LANGS.find((l) => l.code === code)?.label || 'Tiếng Việt'

export const TIMEZONES = [
  { id: 'hcm', label: 'Hồ Chí Minh', gmt: 'GMT+7' },
  { id: 'bkk', label: 'Bangkok', gmt: 'GMT+7' },
  { id: 'sgp', label: 'Singapore', gmt: 'GMT+8' },
  { id: 'tyo', label: 'Tokyo', gmt: 'GMT+9' },
  { id: 'lon', label: 'London', gmt: 'GMT+0' },
  { id: 'nyc', label: 'New York', gmt: 'GMT-5' },
]
export const CURRENCIES = [
  { id: 'vnd', label: 'VND — đồng', sym: '₫' },
  { id: 'usd', label: 'USD — dollar', sym: '$' },
  { id: 'eur', label: 'EUR — euro', sym: '€' },
  { id: 'jpy', label: 'JPY — yen', sym: '¥' },
  { id: 'sgd', label: 'SGD — dollar', sym: 'S$' },
]
