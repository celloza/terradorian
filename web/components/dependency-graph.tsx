"use client"

import { useMemo } from 'react'
import ReactFlow, { Background, Controls, Node, Edge, MarkerType } from 'reactflow'
import dagre from 'dagre'
import 'reactflow/dist/style.css'

interface DependencyGraphProps {
    components: any[]
    plans: any[]
}

export function DependencyGraph({ components, plans }: DependencyGraphProps) {

    // 1. Build Data & Layout
    const { nodes, edges } = useMemo(() => {
        const flowNodes: Node[] = []
        const flowEdges: Edge[] = []

        // Track IDs to prevent duplicates
        const nodeIds = new Set<string>()
        const edgeIds = new Set<string>()

        // --- Pass 1: Layout Internals (Resources) per Component ---
        const componentLayouts = new Map<string, { width: number, height: number, internalNodes: Node[], internalEdges: Edge[] }>()

        components.forEach((c) => {
            const plan = plans.find(p => p.component_id === c.id)

            // Default Size
            let groupWidth = 300
            let groupHeight = 200
            const internalNodes: Node[] = []
            const internalEdges: Edge[] = []

            if (plan && plan.resource_graph && plan.resource_graph.nodes.length > 0) {
                const g = new dagre.graphlib.Graph()
                g.setGraph({ rankdir: 'TB', nodesep: 20, ranksep: 40, marginx: 20, marginy: 40 })
                g.setDefaultEdgeLabel(() => ({}))

                // Track local IDs for this graph
                const localIds = new Set<string>()

                // Create a map of changes for quick lookup
                // Create a map of changes for quick lookup
                const changes = new Map<string, string[]>()
                // API returns resource_changes inside terraform_plan object
                const resourceChanges = plan.terraform_plan?.resource_changes || []
                if (resourceChanges.length > 0) {
                    resourceChanges.forEach((rc: any) => {
                        changes.set(rc.address, rc.change.actions)
                    })
                }

                // Helper to get color
                const getStyleForActions = (actions: string[] | undefined) => {
                    // Unchanged (Green)
                    if (!actions || actions.length === 0 || actions.includes('no-op')) return { background: '#d4edda', borderColor: '#c3e6cb' }

                    // Replace (Purple - similar to Create)
                    if (actions.includes('create') && actions.includes('delete')) return { background: '#e0cffc', borderColor: '#b197fc' }

                    // Create (Purple)
                    if (actions.includes('create')) return { background: '#e0cffc', borderColor: '#b197fc' }

                    // Delete (Red)
                    if (actions.includes('delete')) return { background: '#f8d7da', borderColor: '#f5c6cb' }

                    // Update (Orange)
                    if (actions.includes('update')) return { background: '#fff3cd', borderColor: '#ffeeba' }

                    return { background: '#fff', borderColor: '#ddd' }
                }

                plan.resource_graph.nodes.forEach((rNode: any) => {
                    const width = 180
                    const height = 50
                    g.setNode(rNode.id, { width, height, label: rNode.label, type: rNode.type })
                    localIds.add(rNode.id)
                })

                // ... (edges logic remains) ...

                if (plan.resource_graph.edges) {
                    plan.resource_graph.edges.forEach((edge: any) => {
                        if (localIds.has(edge.source) && localIds.has(edge.target)) {
                            g.setEdge(edge.source, edge.target)
                        }
                    })
                }

                dagre.layout(g)

                // Extract positions
                g.nodes().forEach((n) => {
                    const node: any = g.node(n)
                    const actions = changes.get(n)
                    const { background, borderColor } = getStyleForActions(actions)

                    internalNodes.push({
                        id: n,
                        data: { label: node.label, type: node.type },
                        // ReactFlow needs top-left, Dagre gives center
                        position: { x: node.x - node.width / 2, y: node.y - node.height / 2 },
                        parentNode: c.id,
                        extent: 'parent',
                        style: {
                            background: background,
                            border: `1px solid ${borderColor}`,
                            borderRadius: '4px',
                            padding: '8px',
                            width: node.width,
                            fontSize: '10px',
                            textAlign: 'center',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden'
                        },
                    })
                    nodeIds.add(n)
                })

                // Calculate Group Size based on graph content
                groupWidth = Math.max(300, (g.graph().width || 0) + 40)
                groupHeight = Math.max(200, (g.graph().height || 0) + 40)

                if (plan.resource_graph.edges) {
                    plan.resource_graph.edges.forEach((edge: any) => {
                        if (localIds.has(edge.source) && localIds.has(edge.target)) {
                            const edgeId = `e-${edge.source}-${edge.target}`
                            if (!edgeIds.has(edgeId)) {
                                internalEdges.push({
                                    id: edgeId,
                                    source: edge.source,
                                    target: edge.target,
                                    animated: true,
                                    style: { stroke: '#555', strokeWidth: 1 },
                                    markerEnd: { type: MarkerType.ArrowClosed },
                                })
                                edgeIds.add(edgeId)
                            }
                        }
                    })
                }
            }

            componentLayouts.set(c.id, { width: groupWidth, height: groupHeight, internalNodes, internalEdges })
        })

        // --- Pass 2: Layout Externals (Components) ---
        const mainG = new dagre.graphlib.Graph()
        mainG.setGraph({ rankdir: 'LR', nodesep: 50, ranksep: 100, marginx: 50, marginy: 50 })
        mainG.setDefaultEdgeLabel(() => ({}))

        components.forEach((c) => {
            const layout = componentLayouts.get(c.id)!
            mainG.setNode(c.id, { width: layout.width, height: layout.height, label: c.name })
            nodeIds.add(c.id)
        })

        // Inter-component dependencies
        plans.forEach(plan => {
            const sourceId = plan.component_id
            const deps = plan.dependencies || []
            deps.forEach((targetId: string) => {
                if (components.find(c => c.id === targetId)) {
                    mainG.setEdge(sourceId, targetId)
                }
            })
        })

        dagre.layout(mainG)

        // Assembly
        mainG.nodes().forEach((n) => {
            const node = mainG.node(n)
            const layout = componentLayouts.get(n)!

            // Group Node
            flowNodes.push({
                id: n,
                position: { x: node.x - node.width / 2, y: node.y - node.height / 2 },
                data: { label: node.label },
                style: {
                    backgroundColor: 'rgba(240, 240, 240, 0.5)',
                    border: '1px dashed #777',
                    width: layout.width,
                    height: layout.height,
                    fontWeight: 'bold',
                    color: '#333'
                },
                type: 'group',
            })

            // Add internals
            flowNodes.push(...layout.internalNodes)
            flowEdges.push(...layout.internalEdges)
        })

        // Add External Edges
        mainG.edges().forEach((e) => {
            const edgeId = `e-comp-${e.v}-${e.w}`
            if (!edgeIds.has(edgeId)) {
                flowEdges.push({
                    id: edgeId,
                    source: e.v,
                    target: e.w,
                    animated: true,
                    style: { stroke: '#333', strokeWidth: 2, strokeDasharray: '5,5' },
                    label: 'depends on',
                    markerEnd: { type: MarkerType.ArrowClosed },
                    zIndex: 10
                })
                edgeIds.add(edgeId)
            }
        })

        return { nodes: flowNodes, edges: flowEdges }
    }, [components, plans])

    return (
        <div style={{ height: '600px', border: '1px solid #eee', borderRadius: '8px', background: '#fafafa' }}>
            <ReactFlow nodes={nodes} edges={edges} fitView minZoom={0.1} maxZoom={4}>
                <Background color="#aaa" gap={16} />
                <Controls />
            </ReactFlow>
        </div>
    )
}
