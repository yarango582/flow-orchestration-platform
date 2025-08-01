import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import Layout from './components/layout/Layout'
import FlowBuilder from './components/flow-builder/FlowBuilder'
import FlowsList from './components/flows/FlowsList'
import SchedulesList from './components/schedules/SchedulesList'
import ExecutionsList from './components/executions/ExecutionsList'
import NodeCatalog from './components/catalog/NodeCatalog'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<FlowsList />} />
              <Route path="flows" element={<FlowsList />} />
              <Route path="flow-builder" element={<FlowBuilder />} />
              <Route path="flow-builder/:id" element={<FlowBuilder />} />
              <Route path="schedules" element={<SchedulesList />} />
              <Route path="executions" element={<ExecutionsList />} />
              <Route path="catalog" element={<NodeCatalog />} />
            </Route>
          </Routes>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
            }}
          />
        </div>
      </Router>
    </QueryClientProvider>
  )
}

export default App