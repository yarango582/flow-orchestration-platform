import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  HomeIcon,
  RectangleGroupIcon,
  ClockIcon,
  ChartBarIcon,
  BookOpenIcon,
  CogIcon
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

const navigation = [
  { name: 'Inicio', href: '/', icon: HomeIcon },
  { name: 'Flujos', href: '/flows', icon: RectangleGroupIcon },
  { name: 'Programación', href: '/schedules', icon: ClockIcon },
  { name: 'Ejecuciones', href: '/executions', icon: ChartBarIcon },
  { name: 'Catálogo', href: '/catalog', icon: BookOpenIcon },
  { name: 'Configuración', href: '/settings', icon: CogIcon },
]

const Sidebar: React.FC = () => {
  return (
    <div className="w-64 bg-white shadow-sm border-r border-gray-200">
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="flex items-center h-16 px-6 border-b border-gray-200">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <RectangleGroupIcon className="w-5 h-5 text-white" />
            </div>
            <span className="ml-3 text-xl font-semibold text-gray-900">
              Flow Platform
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                clsx(
                  'sidebar-item',
                  isActive ? 'sidebar-item-active' : 'sidebar-item-inactive'
                )
              }
            >
              <item.icon className="w-5 h-5 mr-3" />
              {item.name}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-gray-200">
          <div className="text-xs text-gray-500 text-center">
            v0.1.0 - Fase 1
          </div>
        </div>
      </div>
    </div>
  )
}

export default Sidebar