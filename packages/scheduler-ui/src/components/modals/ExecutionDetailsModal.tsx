import React, { useState, useEffect } from 'react';
// Assuming you have these dependencies installed:
// npm install @headlessui/react @heroicons/react react-hot-toast date-fns
import { Dialog } from '@headlessui/react';
import { 
  XMarkIcon, 
  PlayIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
// These are assumed to be your internal service and type definitions
import { schedulerService, realtimeService } from '@/services';
import { ExecutionDetail, ExecutionLog, ExecutionStatus } from '@/types/api';

// Props interface for the component
interface ExecutionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  executionId: string;
}

/**
 * A modal component to display the detailed information, nodes, and logs of a specific execution.
 * It also subscribes to real-time updates for the execution.
 */
const ExecutionDetailsModal: React.FC<ExecutionDetailsModalProps> = ({
  isOpen,
  onClose,
  executionId
}) => {
  // State management
  const [execution, setExecution] = useState<ExecutionDetail | null>(null);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'nodes' | 'logs'>('overview');
  const [logLevel, setLogLevel] = useState<'debug' | 'info' | 'warn' | 'error' | 'all'>('all');
  const [isRetrying, setIsRetrying] = useState(false);

  /**
   * Effect to load initial data and subscribe to real-time updates when the modal opens.
   * Cleans up the subscription when the component unmounts or dependencies change.
   */
  useEffect(() => {
    if (isOpen && executionId) {
      loadExecutionDetails();
      loadExecutionLogs();
      
      // Subscribe to real-time updates for this execution
      realtimeService.subscribeToExecution(executionId, handleRealtimeUpdate);
      
      // Cleanup function to unsubscribe when the modal closes or executionId changes
      return () => {
        realtimeService.unsubscribeFromExecution(executionId, handleRealtimeUpdate);
      };
    }
  }, [isOpen, executionId]);

  /**
   * Effect to reload logs when the log level filter changes.
   */
  useEffect(() => {
    if (isOpen && executionId) {
      loadExecutionLogs();
    }
  }, [logLevel]);

  /**
   * Fetches the main details of the execution from the server.
   */
  const loadExecutionDetails = async () => {
    setIsLoading(true);
    try {
      const executionDetails = await schedulerService.getExecution(executionId);
      setExecution(executionDetails);
    } catch (error: any) {
      toast.error('Failed to load execution details: ' + error.message);
      onClose(); // Close modal if details can't be loaded
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Fetches the logs for the execution, applying the current log level filter.
   */
  const loadExecutionLogs = async () => {
    try {
      const executionLogs = await schedulerService.getExecutionLogs(executionId, {
        level: logLevel === 'all' ? undefined : logLevel
      });
      setLogs(executionLogs);
    } catch (error: any) {
      toast.error('Failed to load execution logs: ' + error.message);
    }
  };

  /**
   * Handles incoming real-time updates from the websocket service.
   * @param update - The update data object.
   */
  const handleRealtimeUpdate = (update: any) => {
    if (update.executionId !== executionId) return;

    // Update execution status and other details
    setExecution(prev => prev ? {
      ...prev,
      status: update.status || prev.status,
      recordsProcessed: update.recordsProcessed || prev.recordsProcessed,
      endTime: (update.status === 'success' || update.status === 'failed') ? new Date().toISOString() : prev.endTime
    } : null);
    
    // Add new log entry if the update contains a message
    if (update.message) {
      const newLog: ExecutionLog = {
        timestamp: update.timestamp || new Date().toISOString(),
        level: update.level || 'info',
        message: update.message,
        nodeId: update.currentNode
      };
      setLogs(prev => [newLog, ...prev]);
    }
  };

  /**
   * Initiates a retry of a failed execution.
   */
  const handleRetry = async () => {
    if (!execution) return;
    
    setIsRetrying(true);
    try {
      await schedulerService.retryExecution(executionId);
      toast.success('Execution retry initiated.');
      onClose(); // Close modal after initiating retry
    } catch (error: any) {
      toast.error('Failed to retry execution: ' + error.message);
    } finally {
      setIsRetrying(false);
    }
  };

  // --- UI Helper Functions ---

  const getStatusIcon = (status: ExecutionStatus) => {
    const iconClass = "w-5 h-5";
    switch (status) {
      case 'success': return <CheckCircleIcon className={`${iconClass} text-green-500`} />;
      case 'failed': return <XCircleIcon className={`${iconClass} text-red-500`} />;
      case 'running': return <PlayIcon className={`${iconClass} text-blue-500 animate-pulse`} />;
      case 'pending': return <ClockIcon className={`${iconClass} text-yellow-500`} />;
      case 'cancelled': return <XCircleIcon className={`${iconClass} text-gray-500`} />;
      case 'timeout': return <ExclamationTriangleIcon className={`${iconClass} text-orange-500`} />;
      default: return <ClockIcon className={`${iconClass} text-gray-500`} />;
    }
  };

  const getStatusColor = (status: ExecutionStatus) => {
    switch (status) {
      case 'success': return 'text-green-700 bg-green-100';
      case 'failed': return 'text-red-700 bg-red-100';
      case 'running': return 'text-blue-700 bg-blue-100';
      case 'pending': return 'text-yellow-700 bg-yellow-100';
      case 'cancelled': return 'text-gray-700 bg-gray-100';
      case 'timeout': return 'text-orange-700 bg-orange-100';
      default: return 'text-gray-700 bg-gray-100';
    }
  };

  const getLogLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error': return 'text-red-400';
      case 'warn': return 'text-yellow-400';
      case 'info': return 'text-blue-400';
      case 'debug': return 'text-gray-400';
      default: return 'text-gray-400';
    }
  };

  const formatDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const durationMs = end.getTime() - start.getTime();
    
    if (durationMs < 0) return '...';
    if (durationMs < 1000) return `${durationMs}ms`;
    if (durationMs < 60000) return `${(durationMs / 1000).toFixed(2)}s`;
    const minutes = Math.floor(durationMs / 60000);
    const seconds = ((durationMs % 60000) / 1000).toFixed(0);
    return `${minutes}m ${seconds}s`;
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-6xl w-full bg-white rounded-lg shadow-xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <Dialog.Title className="text-lg font-semibold text-gray-900 flex items-center">
                <DocumentTextIcon className="w-5 h-5 mr-2 text-blue-600" />
                Execution Details
                {execution && (
                  <span className={`ml-3 px-2.5 py-1 text-xs font-medium rounded-full ${getStatusColor(execution.status)}`}>
                    {execution.status.toUpperCase()}
                  </span>
                )}
              </Dialog.Title>
              <div className="flex items-center space-x-2">
                {execution?.status === 'failed' && (
                  <button onClick={handleRetry} disabled={isRetrying} className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center transition-colors">
                    <ArrowPathIcon className={`w-4 h-4 mr-1.5 ${isRetrying ? 'animate-spin' : ''}`} />
                    {isRetrying ? 'Retrying...' : 'Retry'}
                  </button>
                )}
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"><XMarkIcon className="w-5 h-5" /></button>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center h-[600px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Loading execution details...</span>
              </div>
            ) : execution ? (
              <div className="flex flex-col h-[600px]">
                <div className="flex border-b border-gray-200">
                  {[{ id: 'overview', label: 'Overview' }, { id: 'nodes', label: 'Node Executions' }, { id: 'logs', label: 'Logs' }].map((tab) => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-6 py-3 text-sm font-medium ${activeTab === tab.id ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="flex-1 p-6 overflow-y-auto bg-gray-50/50">
                  {/* Overview Tab */}
                  {activeTab === 'overview' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-4 rounded-lg border"><div className="flex items-center">{getStatusIcon(execution.status)}<span className="ml-2 font-medium text-gray-900">Status</span></div><p className="mt-1 text-2xl font-semibold capitalize">{execution.status}</p></div>
                        <div className="bg-white p-4 rounded-lg border"><div className="flex items-center"><ClockIcon className="w-5 h-5 text-gray-400" /><span className="ml-2 font-medium text-gray-900">Duration</span></div><p className="mt-1 text-2xl font-semibold">{formatDuration(execution.startTime, execution.endTime)}</p></div>
                        <div className="bg-white p-4 rounded-lg border"><div className="flex items-center"><DocumentTextIcon className="w-5 h-5 text-gray-400" /><span className="ml-2 font-medium text-gray-900">Records</span></div><p className="mt-1 text-2xl font-semibold">{execution.recordsProcessed.toLocaleString()}</p></div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white p-4 rounded-lg border"><h3 className="text-lg font-medium text-gray-900 mb-3">Execution Info</h3><dl className="space-y-3"><div className="flex justify-between"><dt className="text-sm text-gray-500">Execution ID</dt><dd className="text-sm text-gray-800 font-mono">{execution.id}</dd></div><div className="flex justify-between"><dt className="text-sm text-gray-500">Flow ID</dt><dd className="text-sm text-gray-800 font-mono">{execution.flowId}</dd></div>{execution.scheduleId && <div className="flex justify-between"><dt className="text-sm text-gray-500">Schedule ID</dt><dd className="text-sm text-gray-800 font-mono">{execution.scheduleId}</dd></div>}<div className="flex justify-between"><dt className="text-sm text-gray-500">Retry Count</dt><dd className="text-sm text-gray-800">{execution.retryCount}</dd></div></dl></div>
                        <div className="bg-white p-4 rounded-lg border"><h3 className="text-lg font-medium text-gray-900 mb-3">Timing</h3><dl className="space-y-3"><div><dt className="text-sm font-medium text-gray-500">Start Time</dt><dd className="text-sm text-gray-900">{format(new Date(execution.startTime), 'MMM dd, yyyy, HH:mm:ss')}</dd></div>{execution.endTime && <div><dt className="text-sm font-medium text-gray-500">End Time</dt><dd className="text-sm text-gray-900">{format(new Date(execution.endTime), 'MMM dd, yyyy, HH:mm:ss')}</dd></div>}</dl></div>
                      </div>
                      {execution.errorMessage && <div className="bg-red-50 border border-red-200 p-4 rounded-lg"><h3 className="text-lg font-medium text-red-800 mb-2">Error Details</h3><p className="text-sm text-red-700 font-mono whitespace-pre-wrap">{execution.errorMessage}</p></div>}
                    </div>
                  )}

                  {/* Node Executions Tab */}
                  {activeTab === 'nodes' && (
                    <div className="space-y-4"><h3 className="text-lg font-medium text-gray-900">Node Executions</h3>{execution.nodeExecutions.length === 0 ? <p className="text-gray-500">No node executions found.</p> : <div className="space-y-3">{execution.nodeExecutions.map((node, index) => (<div key={index} className="border bg-white border-gray-200 rounded-lg p-4"><div className="flex items-start justify-between"><div className="flex-1"><div className="flex items-center space-x-2">{getStatusIcon(node.status)}<h4 className="font-medium text-gray-900">{node.nodeType}</h4><span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(node.status)}`}>{node.status}</span></div><p className="text-sm text-gray-500 mt-1 font-mono">Node ID: {node.nodeId}</p><div className="mt-2 grid grid-cols-3 gap-4 text-sm"><div><span className="text-gray-500">Duration:</span><span className="ml-1 font-medium">{formatDuration(node.startTime, node.endTime)}</span></div><div><span className="text-gray-500">Records:</span><span className="ml-1 font-medium">{node.recordsProcessed}</span></div><div><span className="text-gray-500">Started:</span><span className="ml-1 font-medium">{format(new Date(node.startTime), 'HH:mm:ss.SSS')}</span></div></div>{node.errorMessage && <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded"><p className="text-xs text-red-700 font-mono">{node.errorMessage}</p></div>}</div></div></div>))}</div>}</div>
                  )}

                  {/* Logs Tab */}
                  {activeTab === 'logs' && (
                    <div className="space-y-4 h-full flex flex-col"><div className="flex items-center justify-between"><h3 className="text-lg font-medium text-gray-900">Execution Logs</h3><select value={logLevel} onChange={(e) => setLogLevel(e.target.value as any)} className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"><option value="all">All Levels</option><option value="error">Error</option><option value="warn">Warning</option><option value="info">Info</option><option value="debug">Debug</option></select></div><div className="bg-gray-900 text-white p-4 rounded-lg font-mono text-sm flex-1 overflow-y-auto"><pre className="whitespace-pre-wrap">{logs.length === 0 ? <span className="text-gray-500">No logs available for this level.</span> : logs.map((log, index) => (<div key={index} className="flex items-start"><span className="text-gray-500 w-24 shrink-0">[{format(new Date(log.timestamp), 'HH:mm:ss.SSS')}]</span><span className={`w-16 shrink-0 ${getLogLevelColor(log.level)} font-semibold`}>[{log.level.toUpperCase()}]</span>{log.nodeId && <span className="text-cyan-400 w-24 shrink-0">[{log.nodeId}]</span>}<span className="ml-2 text-gray-300">{log.message}</span></div>))}</pre></div></div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-6 h-[600px] flex items-center justify-center"><p className="text-gray-500">Execution not found or an error occurred.</p></div>
            )}
          </Dialog.Panel>
        </div>
      </div>
    </Dialog>
  );
};

export default ExecutionDetailsModal;
