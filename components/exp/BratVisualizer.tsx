import React, { useState, useMemo } from "react";

const AnnotationViewer = () => {
  const [containerWidth, setContainerWidth] = useState(600);

  // Text and annotation data
  const text =
    "The dump truck was inspected and it was found that it had a blown head gasket";

  // Entity definitions with character offsets - now with overlapping entities
  const entities = [
    {
      id: "T1",
      type: "Object",
      start: 4,
      end: 14,
      text: "dump truck",
      color: "#7fa2ff",
    },
    {
      id: "T1.1",
      type: "Object",
      start: 9,
      end: 14,
      text: "truck",
      color: "#7fa2ff",
    },
    {
      id: "T2",
      type: "Activity",
      start: 19,
      end: 28,
      text: "inspected",
      color: "#ff7f7f",
    },
    {
      id: "T3",
      type: "State",
      start: 60,
      end: 65,
      text: "blown",
      color: "#90ee90",
    },
    {
      id: "T4",
      type: "Object",
      start: 66,
      end: 77,
      text: "head gasket",
      color: "#7fa2ff",
    },
  ];

  // Relation definitions
  const relations = [
    { id: "R1", type: "hasPart", arg1: "T1", arg2: "T4", color: "#333" },
    { id: 'R2', type: 'hasState', arg1: 'T4', arg2: 'T3', color: '#333' },
    { id: "R3", type: "hasParticipant", arg1: "T2", arg2: "T4", color: "#333" },
    { id: "R4", type: "isA", arg1: "T1", arg2: "T1.1", color: "#333" },
  ];

  // Constants for layout
  const charWidth = 8;
  const lineHeight = 20;
  const padding = 20;
  const baseLineSpacing = 24;
  const arcSpacing = 25;
  const entityBoxHeight = 20;
  const entityLayerSpacing = 22;

  // Calculate minimum required width to prevent entity breaking
  const minRequiredWidth = useMemo(() => {
    const widestEntityWidth = Math.max(...entities.map(e => e.text.length * charWidth));
    return widestEntityWidth + (2 * padding) + 50;
  }, [entities, charWidth, padding]);

  // Create text chunks that handle overlapping entities while preserving no-break principle
  const textChunks = useMemo(() => {
    const chunks = [];
    let currentPos = 0;
    
    // Find all breakpoints (entity start/end positions)
    const breakpoints = new Set([0, text.length]);
    entities.forEach(entity => {
      breakpoints.add(entity.start);
      breakpoints.add(entity.end);
    });
    const sortedBreakpoints = Array.from(breakpoints).sort((a, b) => a - b);
    
    // Process each segment between breakpoints
    for (let i = 0; i < sortedBreakpoints.length - 1; i++) {
      const segmentStart = sortedBreakpoints[i];
      const segmentEnd = sortedBreakpoints[i + 1];
      const segmentText = text.slice(segmentStart, segmentEnd);
      
      // Skip empty segments
      if (segmentText.trim().length === 0) {
        continue;
      }
      
      // Find all entities that completely contain this segment
      const containingEntities = entities.filter(entity => 
        entity.start <= segmentStart && entity.end >= segmentEnd
      );
      
      // Find entities that exactly match this segment (for proper entity chunks)
      const exactMatchEntities = entities.filter(entity =>
        entity.start === segmentStart && entity.end === segmentEnd
      );
      
      if (exactMatchEntities.length > 0) {
        // This segment exactly matches one or more entities - create entity chunk
        chunks.push({
          type: 'entity',
          text: segmentText,
          start: segmentStart,
          end: segmentEnd,
          entities: containingEntities.length > 0 ? containingEntities : exactMatchEntities,
          entity: exactMatchEntities[0] // Primary entity for this chunk
        });
      } else if (containingEntities.length > 0) {
        // This segment is contained within entities but doesn't match exactly
        // Split into words but mark them as part of entities
        const words = segmentText.trim().split(/\s+/).filter(word => word.length > 0);
        let wordPos = segmentStart;
        
        words.forEach(word => {
          // Find the actual position of this word in the segment
          const wordIndex = text.indexOf(word, wordPos);
          chunks.push({
            type: 'entity',
            text: word,
            start: wordIndex,
            end: wordIndex + word.length,
            entities: containingEntities,
            entity: containingEntities[0]
          });
          wordPos = wordIndex + word.length;
        });
      } else {
        // Regular text - split into individual words
        const words = segmentText.trim().split(/\s+/).filter(word => word.length > 0);
        let wordPos = segmentStart;
        
        words.forEach(word => {
          const wordIndex = text.indexOf(word, wordPos);
          chunks.push({
            type: 'word',
            text: word,
            start: wordIndex,
            end: wordIndex + word.length,
            entities: [],
            entity: null
          });
          wordPos = wordIndex + word.length;
        });
      }
    }
    
    return chunks;
  }, [entities, text]);

  // Calculate text layout with wrapping that respects entity boundaries
  const textLayout = useMemo(() => {
    const lines = [];
    let currentLine = [];
    let currentX = 0;

    const maxLineWidth = containerWidth - 2 * padding;

    textChunks.forEach((chunk, chunkIndex) => {
      const chunkWidth = chunk.text.length * charWidth;
      const spaceWidth = charWidth;

      // Check if chunk fits on current line
      if (currentX + chunkWidth <= maxLineWidth || currentLine.length === 0) {
        currentLine.push({
          ...chunk,
          x: currentX,
          absoluteStart: chunk.start,
          absoluteEnd: chunk.end,
        });
        currentX += chunkWidth + spaceWidth;
      } else {
        // Start new line
        lines.push({
          chunks: currentLine,
          y: 0,
          lineIndex: lines.length,
        });
        currentLine = [{
          ...chunk,
          x: 0,
          absoluteStart: chunk.start,
          absoluteEnd: chunk.end,
        }];
        currentX = chunkWidth + spaceWidth;
      }
    });

    if (currentLine.length > 0) {
      lines.push({
        chunks: currentLine,
        y: 0,
        lineIndex: lines.length,
      });
    }

    return lines;
  }, [textChunks, containerWidth]);

  // Calculate entity layers for each line to handle overlaps
  const entityLayers = useMemo(() => {
    return textLayout.map(line => {
      // Get all unique entities on this line
      const lineEntities = new Set();
      line.chunks.forEach(chunk => {
        if (chunk.entities && chunk.entities.length > 0) {
          chunk.entities.forEach(entity => lineEntities.add(entity.id));
        }
      });

      // Create layers to avoid overlapping boxes
      const layers = [];
      const entityToLayer = {};

      Array.from(lineEntities).forEach(entityId => {
        const entity = entities.find(e => e.id === entityId);
        if (!entity) return;

        // Find entity spans on this line - collect all chunks that contain this entity
        const entityChunks = line.chunks.filter(chunk => 
          chunk.entities && chunk.entities.some(e => e.id === entityId)
        );
        
        if (entityChunks.length === 0) return;

        // Calculate the full span of this entity on this line
        const entitySpans = [{
          start: Math.min(...entityChunks.map(chunk => chunk.x)),
          end: Math.max(...entityChunks.map(chunk => chunk.x + chunk.text.length * charWidth)),
          entityId: entityId,
          entity: entity
        }];

        // Find a layer where this entity doesn't conflict
        let assignedLayer = -1;
        for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
          const layer = layers[layerIndex];
          let conflicts = false;

          for (const span of entitySpans) {
            for (const existingItem of layer) {
              // Check if spans overlap
              if (!(span.end <= existingItem.start || span.start >= existingItem.end)) {
                conflicts = true;
                break;
              }
            }
            if (conflicts) break;
          }

          if (!conflicts) {
            assignedLayer = layerIndex;
            break;
          }
        }

        // If no suitable layer found, create a new one
        if (assignedLayer === -1) {
          assignedLayer = layers.length;
          layers.push([]);
        }

        // Add entity spans to the assigned layer
        entitySpans.forEach(span => {
          layers[assignedLayer].push(span);
        });

        entityToLayer[entityId] = assignedLayer;
      });

      return { layers, entityToLayer };
    });
  }, [textLayout, entities]);

  // Calculate relations per line and dynamic line spacing
  const lineInfo = useMemo(() => {
    // First pass: get basic entity positions to determine which line each entity is on
    const entityLineMapping = {};

    entities.forEach((entity) => {
      // Find which line contains this entity
      for (let lineIndex = 0; lineIndex < textLayout.length; lineIndex++) {
        const line = textLayout[lineIndex];

        for (let chunkIndex = 0; chunkIndex < line.chunks.length; chunkIndex++) {
          const chunk = line.chunks[chunkIndex];

          if (chunk.entities && chunk.entities.some(e => e.id === entity.id)) {
            entityLineMapping[entity.id] = lineIndex;
            break;
          }
        }
      }
    });

    // Count relations per line
    const relationsPerLine = new Array(textLayout.length).fill(0);
    const sameLineRelations = new Array(textLayout.length).fill(0);
    const crossLineRelations = new Array(textLayout.length).fill(0);

    relations.forEach((relation) => {
      const sourceLine = entityLineMapping[relation.arg1];
      const targetLine = entityLineMapping[relation.arg2];

      if (sourceLine !== undefined && targetLine !== undefined) {
        if (sourceLine === targetLine) {
          sameLineRelations[sourceLine]++;
          relationsPerLine[sourceLine]++;
        } else {
          crossLineRelations[sourceLine]++;
          crossLineRelations[targetLine]++;
          relationsPerLine[sourceLine]++;
          relationsPerLine[targetLine]++;
        }
      }
    });

    // Check which lines have entities and calculate dynamic spacing
    const linesWithEntities = new Set(Object.values(entityLineMapping));
    const lineSpacings = relationsPerLine.map((count, index) => {
      const layerInfo = entityLayers[index];
      const numLayers = layerInfo ? layerInfo.layers.length : 0;
      const entityBoxesHeight = linesWithEntities.has(index) && numLayers > 0 ? 
        numLayers * entityLayerSpacing + 4 : 0;
      const relationSpace = count > 0 ? count * 30 : 0;
      
      if (!linesWithEntities.has(index) && count === 0) {
        return baseLineSpacing;
      }
      return baseLineSpacing + entityBoxesHeight + relationSpace;
    });

    // Calculate cumulative Y positions
    let cumulativeY = 0;
    const linesWithY = textLayout.map((line, index) => {
      const lineWithY = {
        ...line,
        y: cumulativeY,
        spacing: lineSpacings[index],
        relationCount: relationsPerLine[index],
        sameLineRelations: sameLineRelations[index],
        crossLineRelations: crossLineRelations[index],
      };
      cumulativeY += lineSpacings[index];
      return lineWithY;
    });

    return {
      lines: linesWithY,
      entityLineMapping,
      relationsPerLine,
      lineSpacings,
    };
  }, [textLayout, entities, relations, baseLineSpacing, entityLayers]);

  // Calculate entity positions based on wrapped text and layers
  const entityPositions = useMemo(() => {
    const positions = {};

    lineInfo.lines.forEach((line, lineIndex) => {
      const layerInfo = entityLayers[lineIndex];
      if (!layerInfo) return;

      // For each entity on this line
      Object.entries(layerInfo.entityToLayer).forEach(([entityId, layerIndex]) => {
        const entity = entities.find(e => e.id === entityId);
        if (!entity) return;

        // Find all chunks that contain this entity on this line
        const entityChunks = line.chunks.filter(chunk => 
          chunk.entities && chunk.entities.some(e => e.id === entityId)
        );
        
        if (entityChunks.length > 0) {
          // Calculate the span of this entity across all its chunks
          const minX = Math.min(...entityChunks.map(chunk => chunk.x));
          const maxX = Math.max(...entityChunks.map(chunk => chunk.x + chunk.text.length * charWidth));
          
          positions[entityId] = {
            x: padding + minX,
            y: padding + line.y,
            width: maxX - minX,
            lineIndex: lineIndex,
            layerIndex: layerIndex,
          };
        }
      });
    });

    return positions;
  }, [entities, lineInfo, entityLayers]);

  // Analyze relations to count incoming/outgoing connections per entity
  const entityConnections = useMemo(() => {
    const connections = {};

    entities.forEach((entity) => {
      connections[entity.id] = {
        outgoing: [],
        incoming: [],
      };
    });

    relations.forEach((relation, index) => {
      if (connections[relation.arg1]) {
        connections[relation.arg1].outgoing.push({
          ...relation,
          relationIndex: index,
        });
      }
      if (connections[relation.arg2]) {
        connections[relation.arg2].incoming.push({
          ...relation,
          relationIndex: index,
        });
      }
    });

    return connections;
  }, [entities, relations]);

  // Calculate SVG height
  const svgHeight = useMemo(() => {
    const lastLine = lineInfo.lines[lineInfo.lines.length - 1];
    const totalTextHeight = lastLine
      ? lastLine.y + lastLine.spacing
      : baseLineSpacing;
    return padding * 2 + totalTextHeight + 50;
  }, [lineInfo, baseLineSpacing]);

  // Render entity with layer support
  const renderEntity = (entity) => {
    const pos = entityPositions[entity.id];
    if (!pos) return null;

    const yOffset = pos.layerIndex * entityLayerSpacing;

    return (
      <g key={entity.id}>
        {/* Entity background box below the text */}
        <rect
          x={pos.x}
          y={pos.y + lineHeight + 4 + yOffset}
          width={pos.width}
          height={entityBoxHeight}
          fill={entity.color}
          fillOpacity={0.2}
          stroke={entity.color}
          strokeWidth={1}
          rx={2}
          ry={2}
        />
        {/* Entity label within the box */}
        <text
          x={pos.x + pos.width / 2}
          y={pos.y + lineHeight + 16 + yOffset}
          textAnchor="middle"
          fontSize="10"
          fill={entity.color}
          fontWeight="bold"
        >
          {entity.type}
        </text>
      </g>
    );
  };

  // Render relation with smart cross-line and overlapping entity handling
  const renderRelation = (relation, index) => {
    const sourcePos = entityPositions[relation.arg1];
    const targetPos = entityPositions[relation.arg2];

    if (!sourcePos || !targetPos) return null;

    // Get connection info for this relation
    const sourceConnections = entityConnections[relation.arg1];
    const targetConnections = entityConnections[relation.arg2];

    // Find this relation's index among source's outgoing relations
    const sourceRelationIndex = sourceConnections.outgoing.findIndex(
      (r) => r.id === relation.id
    );
    const sourceRelationCount = sourceConnections.outgoing.length;

    // Find this relation's index among target's incoming relations
    const targetRelationIndex = targetConnections.incoming.findIndex(
      (r) => r.id === relation.id
    );
    const targetRelationCount = targetConnections.incoming.length;

    // Calculate horizontal offset for source (outgoing arrows)
    const sourceOffset =
      sourceRelationCount > 1
        ? (sourceRelationIndex / (sourceRelationCount - 1) - 0.5) *
          (sourcePos.width * 0.8)
        : 0;

    // Calculate horizontal offset for target (incoming arrows)
    const targetOffset =
      targetRelationCount > 1
        ? (targetRelationIndex / (targetRelationCount - 1) - 0.5) *
          (targetPos.width * 0.8)
        : 0;

    // Apply offsets to connection points, accounting for entity layers
    const sourceYOffset = sourcePos.layerIndex * entityLayerSpacing;
    const targetYOffset = targetPos.layerIndex * entityLayerSpacing;

    const sourceCenter = {
      x: sourcePos.x + sourcePos.width / 2 + sourceOffset,
      y: sourcePos.y + lineHeight + entityBoxHeight + 4 + sourceYOffset,
    };

    const targetCenter = {
      x: targetPos.x + targetPos.width / 2 + targetOffset,
      y: targetPos.y + lineHeight + entityBoxHeight + 4 + targetYOffset,
    };

    const markerId = `arrow-${relation.id}`;
    let labelX, labelY;

    // Check if entities are on the same line
    if (sourcePos.lineIndex === targetPos.lineIndex) {
      // Same line - check if they're overlapping (different layers)
      if (sourcePos.layerIndex !== targetPos.layerIndex) {
        // OVERLAPPING ENTITIES - Use tight side arc
        const layerDifference = Math.abs(sourcePos.layerIndex - targetPos.layerIndex);
        
        // Determine which side to draw the arc on based on horizontal positions
        const sourceLeftOfTarget = sourceCenter.x < targetCenter.x;
        const useLeftSide = sourceLeftOfTarget;
        
        // Calculate a small arc offset - much tighter
        const baseArcWidth = 15;
        const arcWidth = baseArcWidth + (layerDifference * 5) + (index * 3);
        
        // Calculate connection points from the sides of entity boxes
        const sourceYOffset = sourcePos.layerIndex * entityLayerSpacing;
        const targetYOffset = targetPos.layerIndex * entityLayerSpacing;
        
        const sourceBoxY = sourcePos.y + lineHeight + 4 + sourceYOffset + entityBoxHeight / 2;
        const targetBoxY = targetPos.y + lineHeight + 4 + targetYOffset + entityBoxHeight / 2;
        
        // Connect from sides of entity boxes
        const sourceConnectX = useLeftSide ? sourcePos.x : sourcePos.x + sourcePos.width;
        const targetConnectX = useLeftSide ? targetPos.x : targetPos.x + targetPos.width;
        
        // Calculate the side X position for the arc
        const leftmostX = Math.min(sourcePos.x, targetPos.x);
        const rightmostX = Math.max(sourcePos.x + sourcePos.width, targetPos.x + targetPos.width);
        
        const sideX = useLeftSide ? 
          leftmostX - arcWidth :
          rightmostX + arcWidth;
        
        // Create the side arc path - from side of source box to side of target box
        const pathData = `M ${sourceConnectX} ${sourceBoxY} 
                         L ${sideX} ${sourceBoxY} 
                         L ${sideX} ${targetBoxY} 
                         L ${targetConnectX} ${targetBoxY}`;
        
        // Position label on the vertical section
        labelX = sideX + (useLeftSide ? -12 : 12);
        labelY = (sourceBoxY + targetBoxY) / 2;

        return (
          <g key={relation.id}>
            <defs>
              <marker
                id={markerId}
                markerWidth="10"
                markerHeight="10"
                refX="8"
                refY="3"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <polygon points="0,0 0,6 9,3" fill={relation.color} />
              </marker>
            </defs>
            <path
              d={pathData}
              fill="none"
              stroke={relation.color}
              strokeWidth="1.5"
              markerEnd={`url(#${markerId})`}
            />
            <text
              x={labelX}
              y={labelY}
              textAnchor="middle"
              fontSize="10"
              fill={relation.color}
              fontWeight="bold"
              transform={`rotate(${useLeftSide ? -90 : 90} ${labelX} ${labelY})`}
            >
              {relation.type}
            </text>
          </g>
        );
      } else {
        // Same line, same layer - use horizontal arc below
        const lineLayerInfo = entityLayers[sourcePos.lineIndex];
        const maxLayersOnLine = lineLayerInfo ? lineLayerInfo.layers.length : 1;
        const entityLayersHeight = maxLayersOnLine * entityLayerSpacing;
        const arcHeight = 30 + entityLayersHeight + index * arcSpacing;
        const sourceY = sourceCenter.y + arcHeight;
        const targetY = targetCenter.y + arcHeight;

        const pathData = `M ${sourceCenter.x} ${sourceCenter.y} L ${sourceCenter.x} ${sourceY} L ${targetCenter.x} ${targetY} L ${targetCenter.x} ${targetCenter.y}`;
        labelX = (sourceCenter.x + targetCenter.x) / 2;
        labelY = Math.max(sourceY, targetY) + 12;

        return (
          <g key={relation.id}>
            <defs>
              <marker
                id={markerId}
                markerWidth="10"
                markerHeight="10"
                refX="8"
                refY="3"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <polygon points="0,0 0,6 9,3" fill={relation.color} />
              </marker>
            </defs>
            <path
              d={pathData}
              fill="none"
              stroke={relation.color}
              strokeWidth="1.5"
              markerEnd={`url(#${markerId})`}
            />
            <text
              x={labelX}
              y={labelY}
              textAnchor="middle"
              fontSize="10"
              fill={relation.color}
              fontWeight="bold"
            >
              {relation.type}
            </text>
          </g>
        );
      }
    } else {
      // Different lines - create two separate path segments, accounting for entity layer heights
      const sourceLayerInfo = entityLayers[sourcePos.lineIndex];
      const targetLayerInfo = entityLayers[targetPos.lineIndex];
      const sourceLineEntityHeight = sourceLayerInfo ? sourceLayerInfo.layers.length * entityLayerSpacing : 0;
      const targetLineEntityHeight = targetLayerInfo ? targetLayerInfo.layers.length * entityLayerSpacing : 0;
      
      const crossLineOffset = index * 15 + Math.max(sourceLineEntityHeight, targetLineEntityHeight);
      const rightEdge = containerWidth - padding;
      const leftEdge = padding;
      
      const isDownward = sourcePos.lineIndex < targetPos.lineIndex;
      
      let sourcePath, targetPath, sourceExitY, targetEntryY;
      
      if (isDownward) {
        sourceExitY = sourceCenter.y + 20 + crossLineOffset;
        targetEntryY = targetCenter.y + 20 + crossLineOffset;
        
        sourcePath = `M ${sourceCenter.x} ${sourceCenter.y} L ${sourceCenter.x} ${sourceExitY} L ${rightEdge} ${sourceExitY}`;
        targetPath = `M ${leftEdge} ${targetEntryY} L ${targetCenter.x} ${targetEntryY} L ${targetCenter.x} ${targetCenter.y}`;
        
        labelX = (sourceCenter.x + rightEdge) / 2;
        labelY = sourceExitY - 5;
      } else {
        sourceExitY = sourceCenter.y + 20 + crossLineOffset;
        targetEntryY = targetCenter.y + 20 + crossLineOffset;
        
        sourcePath = `M ${sourceCenter.x} ${sourceCenter.y} L ${sourceCenter.x} ${sourceExitY} L ${leftEdge} ${sourceExitY}`;
        targetPath = `M ${rightEdge} ${targetEntryY} L ${targetCenter.x} ${targetEntryY} L ${targetCenter.x} ${targetCenter.y}`;
        
        labelX = (sourceCenter.x + leftEdge) / 2;
        labelY = sourceExitY - 5;
      }

      return (
        <g key={relation.id}>
          <defs>
            <marker
              id={markerId}
              markerWidth="10"
              markerHeight="10"
              refX="8"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <polygon points="0,0 0,6 9,3" fill={relation.color} />
            </marker>
          </defs>

          <path
            d={sourcePath}
            fill="none"
            stroke={relation.color}
            strokeWidth="1.5"
          />

          <path
            d={targetPath}
            fill="none"
            stroke={relation.color}
            strokeWidth="1.5"
            markerEnd={`url(#${markerId})`}
          />

          {/* Continuation indicators */}
          {isDownward ? (
            <>
              <polygon
                points={`${rightEdge - 5},${
                  sourceExitY - 3
                } ${rightEdge},${sourceExitY} ${rightEdge - 5},${sourceExitY + 3}`}
                fill={relation.color}
              />
              <polygon
                points={`${leftEdge},${targetEntryY - 3} ${
                  leftEdge + 5
                },${targetEntryY} ${leftEdge},${targetEntryY + 3}`}
                fill={relation.color}
              />
            </>
          ) : (
            <>
              <polygon
                points={`${leftEdge + 5},${
                  sourceExitY - 3
                } ${leftEdge},${sourceExitY} ${leftEdge + 5},${sourceExitY + 3}`}
                fill={relation.color}
              />
              <polygon
                points={`${rightEdge},${targetEntryY - 3} ${
                  rightEdge - 5
                },${targetEntryY} ${rightEdge},${targetEntryY + 3}`}
                fill={relation.color}
              />
            </>
          )}

          <text
            x={labelX}
            y={labelY}
            textAnchor="middle"
            fontSize="10"
            fill={relation.color}
            fontWeight="bold"
          >
            {relation.type}
          </text>
        </g>
      );
    }
  };

  return (
    <div className="annotation-viewer">
      <div className="mb-4">
        <h3 className="text-lg font-bold mb-2">
          Enhanced Annotation Viewer - With Overlapping Entity Relations
        </h3>

        {/* Width control */}
        <div className="flex items-center gap-4 mb-4">
          <label className="font-medium">Container Width:</label>
          <input
            type="range"
            min={minRequiredWidth}
            max="800"
            value={containerWidth}
            onChange={(e) => setContainerWidth(parseInt(e.target.value))}
            className="flex-1"
            title={`Minimum width: ${minRequiredWidth}px (required for longest entity: "${entities.reduce((longest, entity) => entity.text.length > longest.text.length ? entity : longest).text}")`}
          />
          <span className="text-sm font-mono w-16">{containerWidth}px</span>
        </div>
        
        {/* Width constraint info */}
        {containerWidth <= minRequiredWidth + 10 && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded text-sm">
            <div className="flex items-start gap-2">
              <span className="text-amber-600">⚠️</span>
              <div>
                <strong>Minimum width constraint:</strong> Container cannot be smaller than {minRequiredWidth}px 
                to prevent the entity "{entities.reduce((longest, entity) => entity.text.length > longest.text.length ? entity : longest).text}" from breaking across lines.
              </div>
            </div>
          </div>
        )}
      </div>

      <div
        style={{ width: containerWidth }}
        className="border border-gray-300 overflow-x-auto overflow-y-hidden"
      >
        <svg width={containerWidth} height={svgHeight}>
          {/* Background */}
          <rect width="100%" height="100%" fill="#fafafa" />

          {/* Render text line by line */}
          {lineInfo.lines.map((line, lineIndex) => (
            <g key={lineIndex}>
              {line.chunks.map((chunk, chunkIndex) => (
                <text
                  key={chunkIndex}
                  x={padding + chunk.x}
                  y={padding + line.y + lineHeight}
                  fontSize="14"
                  fontFamily="monospace"
                  fill="#333"
                >
                  {chunk.text}
                  {chunkIndex < line.chunks.length - 1 && <tspan> </tspan>}
                </text>
              ))}
            </g>
          ))}

          {/* Render entities */}
          {entities.map(renderEntity)}

          {/* Render relations */}
          {relations.map(renderRelation)}
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-4 p-4 bg-gray-50 rounded">
        <h4 className="font-semibold mb-2">Annotations:</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <h5 className="font-medium mb-1">Entities:</h5>
            <ul className="space-y-1">
              {entities.map((entity) => (
                <li key={entity.id} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded border"
                    style={{
                      backgroundColor: entity.color + "80",
                      borderColor: entity.color,
                    }}
                  ></div>
                  <span className="text-xs">
                    {entity.text} → {entity.type} ({entity.start}-{entity.end})
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h5 className="font-medium mb-1">Relations:</h5>
            <ul className="space-y-1">
              {relations.map((relation) => {
                const source = entities.find((e) => e.id === relation.arg1);
                const target = entities.find((e) => e.id === relation.arg2);
                return (
                  <li key={relation.id} className="flex items-center gap-2">
                    <div
                      className="w-3 h-0.5"
                      style={{ backgroundColor: relation.color }}
                    ></div>
                    <span className="text-xs">
                      {relation.type}({source?.text}, {target?.text})
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>

      {/* Debug Information */}
      <div className="mt-4 p-4 bg-blue-50 rounded">
        <h4 className="font-semibold mb-2">Debug Information:</h4>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm">
          {/* Line Information */}
          <div>
            <h5 className="font-medium mb-2">Line Heights & Entity Layers:</h5>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {lineInfo.lines.map((line, index) => {
                const layerInfo = entityLayers[index];
                return (
                  <div
                    key={index}
                    className="p-2 bg-white rounded border text-xs"
                  >
                    <div>
                      <strong>Line {index}:</strong> Y={line.y}px, Spacing=
                      {line.spacing}px
                    </div>
                    <div>
                      Entity Layers: {layerInfo.layers.length}, Relations: {line.relationCount}
                    </div>
                    {layerInfo.layers.map((layer, layerIdx) => (
                      <div key={layerIdx} className="ml-2 text-gray-600">
                        Layer {layerIdx}: {layer.map(item => entities.find(e => e.id === item.entityId)?.type || item.entityId).join(', ')}
                      </div>
                    ))}
                    <div className="text-gray-600 truncate">
                      Text: "{line.chunks.map((c) => c.text).join(" ")}"
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Entity Positions */}
          <div>
            <h5 className="font-medium mb-2">Entity Positions:</h5>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {entities.map((entity) => {
                const pos = entityPositions[entity.id];
                const lineNum = lineInfo.entityLineMapping[entity.id];
                const connections = entityConnections[entity.id];
                return (
                  <div
                    key={entity.id}
                    className="p-2 bg-white rounded border text-xs"
                  >
                    <div>
                      <strong>{entity.id}</strong> ({entity.type}): "
                      {entity.text}"
                    </div>
                    <div>
                      Position: x={pos?.x}px, y={pos?.y}px, width={pos?.width}px
                    </div>
                    <div>
                      Character span: {entity.start}-{entity.end}, Line: {lineNum}, Layer: {pos?.layerIndex}
                    </div>
                    <div>
                      Connections: {connections.outgoing.length} outgoing,{" "}
                      {connections.incoming.length} incoming
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnnotationViewer;