import React, { useCallback, useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import ReactFlow, {
  Node,
  Edge,
  Connection,
  useNodesState,
  useEdgesState,
  addEdge,
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
  const nodeInstanceToNode = (nodeInstance: any): Node => {
    console.log('Converting NodeInstance to ReactFlow Node:', nodeInstance)
    console.log('NodeInstance config:', nodeInstance.config)
    const result = {
      id: nodeInstance.id,
      type: 'custom',
      position: nodeInstance.position,
      data: {
        type: nodeInstance.type,
        name: nodeInstance.name || nodeInstance.type,
        category: nodeInstance.category || 'default',
        config: nodeInstance.config || {}
      }
    }
    console.log('Converted Node:', result)
    console.log('Converted Node data.config:', result.data.config)
    return result
  }

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
  const nodeToNodeInstance = (node: Node): any => {
    console.log('Converting ReactFlow Node to NodeInstance:', node)
    console.log('Node data config:', node.data?.config)
    const result = {
      id: node.id,
      type: node.data?.type || 'unknown',
      name: node.data?.name,
      category: node.data?.category,
      version: '1.0.0',
      position: node.position,
      config: node.data?.config || {}
    }
    console.log('Converted NodeInstance:', result)
    console.log('Converted config:', result.config)
    return result
  }

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
      console.log('Loaded flow from API:', flow)
      setCurrentFlow(flow)
      
      const reactFlowNodes = (flow.nodes || []).map(nodeInstanceToNode)
      const reactFlowEdges = (flow.connections || []).map(nodeConnectionToEdge)
      
      console.log('Converted to ReactFlow nodes:', reactFlowNodes)
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
    console.log('Adding new node:', newNode)
    setNodes((nds) => [...nds, newNode])
  }, [nodes.length, setNodes])

  const updateNodeConfig = useCallback((nodeId: string, config: any) => {
    console.log('FlowBuilder: Updating node config', { nodeId, config })
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          const updatedNode = {
            ...node,
            data: {
              ...node.data,
              config: { ...(node.data.config || {}), ...config }
            }
          }
          console.log('FlowBuilder: Updated node', updatedNode)
          console.log('FlowBuilder: New config is', updatedNode.data.config)
          return updatedNode
        }
        return node
      })
    )
  }, [setNodes])

  // Sync selectedNode with updated nodes state
  useEffect(() => {
    if (selectedNode) {
      const updatedSelectedNode = nodes.find(node => node.id === selectedNode.id)
      if (updatedSelectedNode && updatedSelectedNode !== selectedNode) {
        console.log('FlowBuilder: Syncing selectedNode with updated node data')
        setSelectedNode(updatedSelectedNode)
      }
    }
  }, [nodes, selectedNode])

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
            deleteKeyCode={null} // Disable delete key to prevent interference
            multiSelectionKeyCode={null} // Disable multi-selection key to prevent interference
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