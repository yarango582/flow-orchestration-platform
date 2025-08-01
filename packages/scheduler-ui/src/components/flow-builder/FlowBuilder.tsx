import React, { useCallback, useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { toast } from 'react-hot-toast'

import NodeSidebar from './NodeSidebar'
import CustomNode from './CustomNode'
import PropertiesPanel from './PropertiesPanel'
import FlowToolbar from './FlowToolbar'
import { useFlowStore } from '@/stores/flow-store'
import { flowService } from '@/services'
import LoadingSpinner from '../ui/LoadingSpinner'

const nodeTypes = {
  custom: CustomNode,
}

const initialNodes: Node[] = []
const initialEdges: Edge[] = []

const FlowBuilder: React.FC = () => {
  const { id: flowId } = useParams<{ id: string }>()
  const { currentFlow, setCurrentFlow } = useFlowStore()
  
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  // Convert NodeInstance to ReactFlow Node
  const nodeInstanceToNode = (nodeInstance: any): Node => ({
    id: nodeInstance.id,
    type: 'custom',
    position: nodeInstance.position,
    data: {
      type: nodeInstance.type,
      name: nodeInstance.name || nodeInstance.type,
      category: nodeInstance.category || 'default',
      config: nodeInstance.config || {}
    }
  })

  // Convert NodeConnection to ReactFlow Edge
  const nodeConnectionToEdge = (connection: any): Edge => ({
    id: `${connection.fromNodeId}-${connection.toNodeId}`,
    source: connection.fromNodeId,
    target: connection.toNodeId,
    sourceHandle: connection.fromOutput,
    targetHandle: connection.toInput,
    type: 'smoothstep',
    animated: true
  })

  // Convert ReactFlow Node to NodeInstance
  const nodeToNodeInstance = (node: Node): any => ({
    id: node.id,
    type: node.data?.type || 'unknown',
    version: '1.0.0',
    position: node.position,
    config: node.data?.config || {}
  })

  // Convert ReactFlow Edge to NodeConnection
  const edgeToNodeConnection = (edge: Edge): any => ({
    fromNodeId: edge.source,
    fromOutput: edge.sourceHandle || 'output',
    toNodeId: edge.target,
    toInput: edge.targetHandle || 'input'
  })

  // Load flow when component mounts or flowId changes
  useEffect(() => {
    if (flowId) {
      loadFlow(flowId)
    } else if (currentFlow) {
      // Load from store if available
      const reactFlowNodes = (currentFlow.nodes || []).map(nodeInstanceToNode)
      const reactFlowEdges = (currentFlow.connections || []).map(nodeConnectionToEdge)
      setNodes(reactFlowNodes)
      setEdges(reactFlowEdges)
    } else {
      // Start with empty canvas
      setNodes([])
      setEdges([])
    }
  }, [flowId, currentFlow])

  // Track changes for dirty state
  useEffect(() => {
    setIsDirty(true)
  }, [nodes, edges])

  const loadFlow = async (id: string) => {
    setIsLoading(true)
    try {
      const flow = await flowService.getFlow(id)
      setCurrentFlow(flow)
      
      const reactFlowNodes = (flow.nodes || []).map(nodeInstanceToNode)
      const reactFlowEdges = (flow.connections || []).map(nodeConnectionToEdge)
      
      setNodes(reactFlowNodes)
      setEdges(reactFlowEdges)
      setIsDirty(false)
      toast.success(`Flow "${flow.name}" loaded successfully`)
    } catch (error: any) {
      toast.error(`Failed to load flow: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge({ ...params, type: 'smoothstep', animated: true }, eds))
    },
    [setEdges]
  )

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node)
    setIsPropertiesOpen(true)
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
  }, [])

  const addNode = useCallback((nodeType: string, nodeName: string, category: string) => {
    const newNode: Node = {
      id: `${nodes.length + 1}`,
      type: 'custom',
      position: { x: Math.random() * 400 + 100, y: Math.random() * 400 + 100 },
      data: {
        type: nodeType,
        name: nodeName,
        category,
        config: {}
      },
    }
    setNodes((nds) => [...nds, newNode])
  }, [nodes.length, setNodes])

  const updateNodeConfig = useCallback((nodeId: string, config: any) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              config: { ...node.data.config, ...config }
            }
          }
        }
        return node
      })
    )
  }, [setNodes])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="flex h-full bg-gray-50">
      {/* Node Sidebar */}
      <NodeSidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        onAddNode={addNode}
      />

      {/* Main Canvas */}
      <div className="flex-1 flex flex-col">
        <FlowToolbar
          flowData={{ 
            nodes: nodes.map(nodeToNodeInstance), 
            connections: edges.map(edgeToNodeConnection) 
          }}
          onFlowLoad={(flow) => {
            const reactFlowNodes = (flow.nodes || []).map(nodeInstanceToNode)
            const reactFlowEdges = (flow.connections || []).map(nodeConnectionToEdge)
            setNodes(reactFlowNodes)
            setEdges(reactFlowEdges)
            setCurrentFlow(flow)
            setIsDirty(false)
          }}
          onClearCanvas={() => {
            setNodes([])
            setEdges([])
            setCurrentFlow(null)
            setIsDirty(false)
          }}
          onPreview={() => {
            // Handle preview logic
          }}
          isDirty={isDirty}
        />
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            className="bg-gray-50"
          >
            <Controls />
            <MiniMap />
            <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
          </ReactFlow>
        </div>
      </div>

      {/* Properties Panel */}
      <PropertiesPanel
        isOpen={isPropertiesOpen}
        onToggle={() => setIsPropertiesOpen(!isPropertiesOpen)}
        selectedNode={selectedNode}
        onUpdateConfig={updateNodeConfig}
      />
    </div>
  )
}

export default FlowBuilder