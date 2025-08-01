import React, { useState, useEffect } from 'react';
// Assuming you have these dependencies installed:
// npm install @headlessui/react @heroicons/react react-hot-toast date-fns
import { Dialog } from '@headlessui/react';
import { 
  XMarkIcon, 
  FolderOpenIcon,
  DocumentIcon,
  MagnifyingGlassIcon,
  CalendarIcon,
  EyeIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
// These are assumed to be your internal service and type definitions
import { flowService } from '@/services';
import { FlowSummary, FlowStatus } from '@/types/api';

// Props interface for the component
interface FlowLoadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoad: (flow: any) => void;
}

/**
 * A modal component for browsing, searching, and loading existing flows.
 */
const FlowLoadModal: React.FC<FlowLoadModalProps> = ({
  isOpen,
  onClose,
  onLoad
}) => {
  // State management
  const [flows, setFlows] = useState<FlowSummary[]>([]);
  const [filteredFlows, setFilteredFlows] = useState<FlowSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<FlowStatus | 'all'>('all');
  const [selectedFlow, setSelectedFlow] = useState<FlowSummary | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const pageSize = 10;

  /**
   * Effect to load the list of flows when the modal is opened or when pagination/filters change.
   */
  useEffect(() => {
    if (isOpen) {
      loadFlows();
    }
  }, [isOpen, currentPage, selectedStatus]);

  /**
   * Effect to apply the client-side search filter whenever the source flows or search query change.
   */
  useEffect(() => {
    let filtered = flows;
    
    if (searchQuery) {
      const lowercasedQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(flow => 
        flow.name.toLowerCase().includes(lowercasedQuery) ||
        (flow.description && flow.description.toLowerCase().includes(lowercasedQuery))
      );
    }
    
    setFilteredFlows(filtered);
  }, [flows, searchQuery]);

  /**
   * Fetches the list of flows from the service based on current filters and pagination.
   */
  const loadFlows = async () => {
    setIsLoading(true);
    try {
      const response = await flowService.getFlows({
        page: currentPage,
        limit: pageSize,
        status: selectedStatus === 'all' ? undefined : selectedStatus
      });
      
      setFlows(response.data);
      if (response.pagination) {
        setTotalPages(response.pagination.totalPages);
      }
    } catch (error: any) {
      toast.error('Failed to load flows: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Fetches the full data for a selected flow and passes it to the parent.
   * @param flowSummary - The summary of the flow to load.
   */
  const handleLoadFlow = async (flowSummary: FlowSummary) => {
    setIsLoading(true);
    try {
      const flow = await flowService.getFlow(flowSummary.id);
      onLoad(flow);
      handleClose();
      toast.success(`Flow "${flow.name}" loaded successfully`);
    } catch (error: any) {
      toast.error('Failed to load flow details: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Deletes a flow after user confirmation.
   * @param flowSummary - The flow to be deleted.
   * @param event - The mouse event, to stop propagation.
   */
  const handleDeleteFlow = async (flowSummary: FlowSummary, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent the row from being selected
    
    // IMPORTANT: window.confirm is blocking and not recommended.
    // Replace this with a dedicated confirmation modal for better UX.
    if (!window.confirm(`Are you sure you want to delete "${flowSummary.name}"? This action cannot be undone.`)) {
      return;
    }
    
    try {
      await flowService.deleteFlow(flowSummary.id);
      toast.success('Flow deleted successfully');
      loadFlows(); // Refresh the list after deletion
      setSelectedFlow(null); // Deselect if it was selected
    } catch (error: any) {
      toast.error('Failed to delete flow: ' + error.message);
    }
  };

  /**
   * Resets all state and closes the modal.
   */
  const handleClose = () => {
    setSearchQuery('');
    setSelectedStatus('all');
    setSelectedFlow(null);
    setCurrentPage(1);
    onClose();
  };

  /**
   * Returns Tailwind CSS classes for a status badge based on the flow status.
   * @param status - The status of the flow.
   */
  const getStatusBadgeColor = (status: FlowStatus): string => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'draft': return 'bg-yellow-100 text-yellow-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'archived': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      {/* Modal Backdrop */}
      <div className="fixed inset-0 bg-black/25" aria-hidden="true" />
      
      {/* Modal Content */}
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-4xl w-full bg-white rounded-lg shadow-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <Dialog.Title className="text-lg font-semibold text-gray-900 flex items-center">
                <FolderOpenIcon className="w-5 h-5 mr-2 text-blue-600" />
                Load Flow
              </Dialog.Title>
              <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {/* Search and Filter Controls */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="flex-1 relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search flows by name or description..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <select
                    value={selectedStatus}
                    onChange={(e) => {
                      setSelectedStatus(e.target.value as FlowStatus | 'all');
                      setCurrentPage(1); // Reset to first page on filter change
                    }}
                    className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="all">All Statuses</option>
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              {/* Flows List */}
              <div className="space-y-3 mb-6 border rounded-md p-2" style={{ minHeight: '400px', maxHeight: '400px', overflowY: 'auto' }}>
                {isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span className="ml-3 text-gray-600">Loading flows...</span>
                  </div>
                ) : filteredFlows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <DocumentIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p className="font-medium">No Flows Found</p>
                    <p className="text-sm">Try adjusting your search or filter criteria.</p>
                  </div>
                ) : (
                  filteredFlows.map((flow) => (
                    <div
                      key={flow.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-all duration-150 hover:bg-gray-50 hover:shadow-sm ${
                        selectedFlow?.id === flow.id ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-gray-200'
                      }`}
                      onClick={() => setSelectedFlow(flow)}
                      onDoubleClick={() => handleLoadFlow(flow)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-1">
                            <h3 className="font-medium text-gray-900">{flow.name}</h3>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusBadgeColor(flow.status)}`}>
                              {flow.status}
                            </span>
                          </div>
                          {flow.description && <p className="text-sm text-gray-600 mb-2 line-clamp-2">{flow.description}</p>}
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            <span className="flex items-center"><DocumentIcon className="w-3 h-3 mr-1" />{flow.nodeCount} nodes</span>
                            <span className="flex items-center"><CalendarIcon className="w-3 h-3 mr-1" />v{flow.version}</span>
                            <span>Updated {format(new Date(flow.updatedAt), 'MMM dd, yyyy')}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1 ml-4">
                          <button onClick={(e) => { e.stopPropagation(); toast.success('Preview feature coming soon!'); }} className="p-2 text-gray-400 hover:text-blue-600 rounded-full hover:bg-gray-100" title="Preview Flow"><EyeIcon className="w-4 h-4" /></button>
                          <button onClick={(e) => handleDeleteFlow(flow, e)} className="p-2 text-gray-400 hover:text-red-600 rounded-full hover:bg-gray-100" title="Delete Flow"><TrashIcon className="w-4 h-4" /></button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t pt-4">
                  <div className="text-sm text-gray-500">Page {currentPage} of {totalPages}</div>
                  <div className="flex space-x-2">
                    <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1 || isLoading} className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Previous</button>
                    <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages || isLoading} className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
                  </div>
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex justify-end space-x-3 pt-6 border-t">
                <button onClick={handleClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">Cancel</button>
                <button onClick={() => selectedFlow && handleLoadFlow(selectedFlow)} disabled={!selectedFlow || isLoading} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed">
                  {isLoading && selectedFlow ? 'Loading...' : 'Load Selected Flow'}
                </button>
              </div>
            </div>
          </Dialog.Panel>
        </div>
      </div>
    </Dialog>
  );
};

export default FlowLoadModal;
