import React from 'react'
import { BellIcon, UserCircleIcon } from '@heroicons/react/24/outline'

const Header: React.FC = () => {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-semibold text-gray-900">
            Orquestador de Flujos
          </h1>
        </div>

        <div className="flex items-center space-x-4">
          {/* Health Status */}
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span className="text-sm text-gray-600">Sistema Operativo</span>
          </div>

          {/* Notifications */}
          <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <BellIcon className="w-5 h-5" />
          </button>

          {/* User Menu */}
          <div className="flex items-center space-x-3">
            <div className="text-right">
              <div className="text-sm font-medium text-gray-900">
                Administrador
              </div>
              <div className="text-xs text-gray-500">
                admin@flow-platform.com
              </div>
            </div>
            <button className="p-1 text-gray-400 hover:text-gray-600 rounded-lg transition-colors">
              <UserCircleIcon className="w-8 h-8" />
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header