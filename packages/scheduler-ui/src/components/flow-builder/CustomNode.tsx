import React from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import {
  CircleStackIcon,
  FunnelIcon,
  ArrowsRightLeftIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

const nodeIcons = {
  'postgresql-query': CircleStackIcon,
  'data-filter': FunnelIcon,
  'field-mapper': ArrowsRightLeftIcon,
  'http-request': GlobeAltIcon,
}

const nodeColors = {
  database: 'bg-blue-50 border-blue-200 text-blue-800',
  transformation: 'bg-green-50 border-green-200 text-green-800',
  'external-api': 'bg-orange-50 border-orange-200 text-orange-800',
}

interface CustomNodeData {
  type: string
  name: string
  category: keyof typeof nodeColors
  config?: Record<string, any>
}

const CustomNode: React.FC<NodeProps<CustomNodeData>> = ({ data, selected }) => {
  const Icon = nodeIcons[data.type as keyof typeof nodeIcons] || CircleStackIcon
  const colorClass = nodeColors[data.category] || nodeColors.database

  return (
    <div
      className={clsx(
        'px-4 py-3 shadow-lg rounded-lg border-2 min-w-[200px]',
        colorClass,
        selected && 'ring-2 ring-primary-500 ring-offset-2'
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-gray-400"
      />
      
      <div className="flex items-center space-x-3">
        <div className="flex-shrink-0">
          <Icon className="w-5 h-5" />
        </div>
        
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">
            {data.name}
          </div>
          <div className="text-xs opacity-75 capitalize">
            {data.category.replace('-', ' ')}
          </div>
        </div>
      </div>

      {/* Configuration indicator */}
      {data.config && Object.keys(data.config).length > 0 && (
        <div className="mt-2 flex items-center space-x-1">
          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
          <span className="text-xs opacity-75">Configurado</span>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-gray-400"
      />
    </div>
  )
}

export default CustomNode