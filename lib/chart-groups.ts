/**
 * Chart Groups Configuration
 * Defines the grouping of charts for different analytical perspectives
 */

export type ChartGroupId = 'market-analysis' | 'coherent-opportunity' | 'customer-intelligence'

export interface ChartGroup {
  id: ChartGroupId
  label: string
  description: string
  charts: string[] // Chart identifiers that belong to this group
  icon?: string
}

export const CHART_GROUPS: ChartGroup[] = [
  {
    id: 'market-analysis',
    label: 'Market Analysis',
    description: 'Core market metrics and trends',
    charts: ['grouped-bar', 'multi-line', 'heatmap', 'comparison-table', 'waterfall'],
    icon: '📊'
  },
  {
    id: 'coherent-opportunity',
    label: 'Coherent Opportunity Matrix',
    description: 'Opportunity identification and analysis',
    charts: ['bubble'],
    icon: '🎯'
  },
  {
    id: 'customer-intelligence',
    label: 'Customer Intelligence',
    description: 'Customer database — Propositions 1–3',
    charts: ['customer-intelligence-framework'],
    icon: '🧑‍💼'
  }
]

export const DEFAULT_CHART_GROUP: ChartGroupId = 'market-analysis'

/**
 * Get chart group by ID
 */
export function getChartGroup(id: ChartGroupId): ChartGroup | undefined {
  return CHART_GROUPS.find(group => group.id === id)
}

/**
 * Check if a chart belongs to a group
 */
export function isChartInGroup(chartId: string, groupId: ChartGroupId): boolean {
  const group = getChartGroup(groupId)
  return group ? group.charts.includes(chartId) : false
}

/**
 * Get all charts for a group
 */
export function getChartsForGroup(groupId: ChartGroupId): string[] {
  const group = getChartGroup(groupId)
  return group ? group.charts : []
}
