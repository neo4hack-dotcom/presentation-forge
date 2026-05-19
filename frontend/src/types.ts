// Shared types for the Presentation Forge frontend.

// ---------- Theme ----------

export type CoverStyle = 'minimal' | 'bold' | 'mesh' | 'split' | 'editorial' | 'geometric'
export type DividerStyle = 'gradient' | 'minimal' | 'numbered'
export type TemplateStyle = 'consulting' | 'executive' | 'dark-board'

/** 9-position grid used for cover-page logo placement. */
export type LogoGridPosition =
  | 'top-left' | 'top-center' | 'top-right'
  | 'middle-left' | 'middle-center' | 'middle-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right'

/** 3-position row used for header/footer logo placement. */
export type LogoRowPosition = 'left' | 'center' | 'right'

export interface Theme {
  name: string
  primary: string
  secondary: string
  accent: string
  background: string
  surface: string
  text: string
  muted: string
  heading_font: string
  body_font: string
  mono_font: string
  logo: string | null
  footer: string
  template: TemplateStyle
  dark: boolean
  cover_style: CoverStyle
  divider_style: DividerStyle
  accent_shape?: 'bar' | 'dot' | 'line' | 'triangle' | 'none'
  index_style?: 'list' | 'grid' | 'numbered'

  // Logo placement (v1.3)
  show_logo_on_cover?: boolean
  show_logo_on_header?: boolean
  show_logo_on_footer?: boolean
  logo_size_cover?: number
  logo_position_cover?: LogoGridPosition
  logo_size_header?: number
  logo_position_header?: LogoRowPosition
  logo_size_footer?: number
  logo_position_footer?: LogoRowPosition
}

export type ThemePatch = Partial<Theme>

// ---------- Deck / slides ----------

export type SlideLayout =
  | 'title' | 'index' | 'section' | 'bullets' | 'two-column'
  | 'kpi' | 'big-number' | 'quote' | 'table' | 'timeline'
  | 'swot' | 'matrix' | 'process' | 'pyramid' | 'comparison'
  | 'icon-grid' | 'chart' | 'closing'

export type ChartType =
  | 'bar' | 'line' | 'area' | 'donut' | 'pie'
  | 'stacked-bar' | 'horizontal-bar' | 'waterfall' | 'funnel' | 'gauge'

export interface KpiTile {
  label: string
  value: string
  delta?: string
  trend?: 'up' | 'down' | 'flat'
}

export interface ChartSpec {
  type: ChartType
  labels?: string[]
  series?: { name: string; values: number[] }[]
  ylabel?: string
  insight?: string
  max?: number
}

export interface Slide {
  id: string
  layout: SlideLayout
  title?: string
  subtitle?: string
  body?: string
  bullets?: string[]
  left?: { title?: string; bullets?: string[] }
  right?: { title?: string; bullets?: string[] }
  kpis?: KpiTile[]
  quote?: { text: string; author?: string }
  table?: { headers: string[]; rows: (string | number)[][] }
  timeline?: { when: string; what: string; detail?: string }[]
  swot?: { strengths?: string[]; weaknesses?: string[]; opportunities?: string[]; threats?: string[] }
  matrix?: {
    x_label?: string; y_label?: string
    q1?: { title?: string; items?: string[] }
    q2?: { title?: string; items?: string[] }
    q3?: { title?: string; items?: string[] }
    q4?: { title?: string; items?: string[] }
  }
  process?: { steps?: { title: string; detail?: string }[] }
  pyramid?: { tiers?: { label: string; detail?: string }[] }
  comparison?: { items?: { title: string; highlight?: boolean; points?: string[] }[] }
  icon_grid?: { tiles?: { icon?: string; title: string; detail?: string }[] }
  big_number?: { value: string; label?: string; delta?: string; trend?: 'up' | 'down' | 'flat'; context?: string }
  chart?: ChartSpec
  footnote?: string
  notes?: string
  // Client-only flags (not persisted on backend)
  __pending?: boolean
  __history?: Slide[]
}

export interface Deck {
  title: string
  subtitle?: string
  author?: string
  date?: string
  audience?: string
  executive_summary?: string
  slides: Slide[]
}

// ---------- Project / brand kit ----------

export interface ProjectListItem {
  id: string
  name: string
  updated_at: number
  n_slides: number
}

export interface FullProject extends ProjectListItem {
  prompt: string
  context: string
  audience: string
  deck: Deck | null
  theme: ThemePatch | null
}

export interface BrandKitSummary {
  id: string
  name: string
  primary: string
  secondary: string
  accent: string
  logo?: string | null
  dark: boolean
  updated_at: number
}

// ---------- LLM config ----------

export type ProviderId = 'ollama' | 'openai'

export interface LLMConfig {
  provider: ProviderId
  base_url: string
  default_model: string
  outline_model: string
  timeout: number
  api_key_set: boolean
}

export interface LLMConfigPatch {
  provider?: ProviderId
  base_url?: string
  api_key?: string
  default_model?: string
  outline_model?: string
  timeout?: number
}

// ---------- Critic / fact-check ----------

export interface CriticIssue {
  slide_id?: string | null
  severity: 'low' | 'medium' | 'high'
  category: string
  issue: string
  suggestion?: string
  _resolved?: boolean
}

export interface CriticMissingSlide {
  after_slide_id?: string | null
  layout: SlideLayout
  title: string
  why?: string
  _resolved?: boolean
}

export interface CriticReview {
  overall_score: number
  summary: string
  issues: CriticIssue[]
  missing_slides: CriticMissingSlide[]
  strengths: string[]
}

export interface FactCheckResult {
  checked: number
  supported: number
  flagged: { slide_id: string; field: string; claim: string; snippet: string }[]
}

// ---------- Streaming events ----------

export type StreamEvent =
  | { event: 'status'; message: string }
  | { event: 'outline'; outline: Deck }
  | { event: 'slide'; slide: Slide }
  | { event: 'done'; deck: Deck }
  | { event: 'error'; message: string }

// ---------- UI ----------

export interface Toast {
  type?: 'success' | 'error' | ''
  message: string
}
