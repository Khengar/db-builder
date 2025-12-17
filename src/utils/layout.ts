import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();

const layoutOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  
  // SPACING: Now that connections work, these values will create a wide "River" flow
  'elk.layered.spacing.nodeNodeBetweenLayers': '400', // Horizontal Highway
  'elk.spacing.nodeNode': '100',                      // Vertical Gap
  'elk.spacing.edgeNode': '60',                       // Arrow Padding
  
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
  'elk.layered.spacing.edgeNodeBetweenLayers': '50',
};

export const getLayoutedElements = async (nodes: any[], relations: any[]) => {
  if (nodes.length === 0) return { nodes, edges: relations };

  // 1. MAP RELATIONS TO GRAPH EDGES (The Critical Fix)
  // We convert your DB "from/to" format into standard "source/target" for the graph engine
  const mappedEdges = relations.map((r) => ({
    id: r.id,
    source: r.from.tableId, // <--- WAS MISSING
    target: r.to.tableId,   // <--- WAS MISSING
  }));

  // 2. SANITIZE
  const validNodes = nodes.filter(n => n.id && typeof n.id === 'string');
  const nodeIds = new Set(validNodes.map(n => n.id));
  
  const validEdges = mappedEdges.filter(e => 
    e.source && e.target && nodeIds.has(e.source) && nodeIds.has(e.target)
  );

  // 3. CONVERT TO ELK FORMAT
  const elkNodes = validNodes.map((node) => ({
    id: node.id,
    width: 300, 
    // Height Calculation: Header(40) + Columns(32) + Padding(20)
    height: 40 + (node.columns?.length || 0) * 32 + 20, 
    layoutOptions: { 'elk.portConstraints': 'FIXED_SIDE' }
  }));

  const elkEdges = validEdges.map((edge) => ({
    id: edge.id,
    sources: [edge.source],
    targets: [edge.target],
  }));

  const graph = {
    id: 'root',
    layoutOptions: layoutOptions,
    children: elkNodes,
    edges: elkEdges,
  };

  try {
    const layoutedGraph = await elk.layout(graph);

    const finalNodes = validNodes.map((node) => {
      const elkNode = layoutedGraph.children?.find((n) => n.id === node.id);
      return {
        ...node,
        targetPosition: 'left',
        sourcePosition: 'right',
        position: { 
            x: elkNode?.x ?? 0, 
            y: elkNode?.y ?? 0 
        },
      };
    });

    return { nodes: finalNodes, edges: relations };

  } catch (err) {
    console.error("Layout Failed:", err);
    return { nodes: validNodes, edges: relations };
  }
};