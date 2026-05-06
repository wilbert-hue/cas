'use client'

import { useDashboardStore } from '@/lib/store'
import { CHART_GROUPS, type ChartGroupId } from '@/lib/chart-groups'
import { BarChart3, Target, Users, type LucideIcon } from 'lucide-react'

// Icon mapping for each chart group
const iconMap: Record<ChartGroupId, LucideIcon> = {
  'market-analysis': BarChart3,
  'coherent-opportunity': Target,
  'customer-intelligence': Users,
}

export function ChartGroupSelector() {
  const {
    selectedChartGroup,
    setSelectedChartGroup
  } = useDashboardStore()

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
      <h3 className="text-xs font-semibold text-black mb-2">Chart View</h3>
      
      <div className="space-y-1">
        {CHART_GROUPS.map((group) => {
          const Icon = iconMap[group.id]
          const isSelected = selectedChartGroup === group.id
          
          return (
            <button
              key={group.id}
              onClick={() => setSelectedChartGroup(group.id)}
              className={`
                w-full text-left px-2 py-1.5 rounded transition-all duration-200
                flex items-center space-x-2
                ${isSelected 
                  ? 'bg-gradient-to-r from-[#52B69A] to-[#34A0A4] text-white shadow-sm' 
                  : 'hover:bg-gray-50 text-black hover:text-black'
                }
              `}
              title={group.description}
            >
              <Icon 
                className={`w-3 h-3 flex-shrink-0 ${isSelected ? 'text-white' : 'text-black'}`} 
              />
              <span className="text-xs font-medium leading-tight">
                {group.label === 'Coherent Opportunity Matrix' ? (
                  <span>
                    Coherent Opportunity
                    <br />
                    Matrix
                  </span>
                ) : group.label === 'Customer Intelligence' ? (
                  <span>
                    Customer
                    <br />
                    Intelligence
                  </span>
                ) : (
                  group.label
                )}
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-2 pt-2 border-t border-gray-100">
        <p className="text-[10px] text-black leading-tight">
          {CHART_GROUPS.find(g => g.id === selectedChartGroup)?.description || 'Select a view to see related charts'}
        </p>
      </div>
    </div>
  )
}
