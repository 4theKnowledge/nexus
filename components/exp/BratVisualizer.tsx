import React, { useState, useMemo } from "react";

const AnnotationViewer = () => {
  const [containerWidth, setContainerWidth] = useState(600);

  // Text and annotation data
  const text =
    "The dump truck was inspected and it was found that it had a blown head gasket";

  // Entity definitions with character offsets
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
  ];

  // Constants for layout
  const charWidth = 8;
  const lineHeight = 20;
  const padding = 20;
  const baseLineSpacing = 24; // Base spacing between lines
  const arcSpacing = 25;

  // Create text chunks that respect entity boundaries
  const textChunks = useMemo(() => {
    const chunks = [];
    let currentPos = 0;
    
    // Sort entities by start position
    const sortedEntities = [...entities].sort((a, b) => a.start - b.start);
    
    sortedEntities.forEach(entity => {
      // Add text before this entity (if any)
      if (currentPos < entity.start) {
        const preText = text.slice(currentPos, entity.start);
        // Split pre-text into individual words
        const preWords = preText.trim().split(/\s+/).filter(word => word.length > 0);
        preWords.forEach(word => {
          chunks.push({
            type: 'word',
            text: word,
            start: currentPos,
            end: currentPos + word.length,
            entity: null
          });
          currentPos += word.length;
          // Skip spaces (they'll be handled during rendering)
          while (currentPos < entity.start && text[currentPos] === ' ') {
            currentPos++;
          }
        });
      }
      
      // Add the entity as a single chunk
      chunks.push({
        type: 'entity',
        text: entity.text,
        start: entity.start,
        end: entity.end,
        entity: entity
      });
      
      currentPos = entity.end;
    });
    
    // Add remaining text after the last entity
    if (currentPos < text.length) {
      const remainingText = text.slice(currentPos);
      const remainingWords = remainingText.trim().split(/\s+/).filter(word => word.length > 0);
      remainingWords.forEach(word => {
        chunks.push({
          type: 'word',
          text: word,
          start: currentPos,
          end: currentPos + word.length,
          entity: null
        });
        currentPos += word.length;
        while (currentPos < text.length && text[currentPos] === ' ') {
          currentPos++;
        }
      });
    }
    
    return chunks;
  }, [text, entities]);

  // Calculate text layout with wrapping that respects entity boundaries
  const textLayout = useMemo(() => {
    const lines = [];
    let currentLine = [];
    let currentX = 0;
    let absoluteCharOffset = 0;

    const maxLineWidth = containerWidth - 2 * padding;

    textChunks.forEach((chunk, chunkIndex) => {
      const chunkWidth = chunk.text.length * charWidth;
      const spaceWidth = charWidth; // space character

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
          y: 0, // Will be calculated later with dynamic spacing
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
        y: 0, // Will be calculated later with dynamic spacing
        lineIndex: lines.length,
      });
    }

    return lines;
  }, [textChunks, containerWidth]);

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

          if (chunk.entity && chunk.entity.id === entity.id) {
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
          // Same line relation
          sameLineRelations[sourceLine]++;
          relationsPerLine[sourceLine]++;
        } else {
          // Cross line relation - affects both lines
          crossLineRelations[sourceLine]++;
          crossLineRelations[targetLine]++;
          relationsPerLine[sourceLine]++;
          relationsPerLine[targetLine]++;
        }
      }
    });

    // Check which lines have entities
    const linesWithEntities = new Set(Object.values(entityLineMapping));
    // Calculate dynamic spacing for each line
    const lineSpacings = relationsPerLine.map((count, index) => {
      const entityBoxHeight = linesWithEntities.has(index) ? 24 : 0; // Only add if line has entities
      const relationSpace = count > 0 ? count * 30 : 0; // Only add space if there are relations
      if (!linesWithEntities.has(index) && count === 0) {
        // If no entities or relations, use base line spacing
        return baseLineSpacing
      }
      return baseLineSpacing + entityBoxHeight + relationSpace;
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
  }, [textLayout, entities, relations, baseLineSpacing]);

  // Calculate entity positions based on wrapped text
  const entityPositions = useMemo(() => {
    const positions = {};

    entities.forEach((entity) => {
      // Find the entity chunk in the layout
      for (let lineIndex = 0; lineIndex < lineInfo.lines.length; lineIndex++) {
        const line = lineInfo.lines[lineIndex];

        for (let chunkIndex = 0; chunkIndex < line.chunks.length; chunkIndex++) {
          const chunk = line.chunks[chunkIndex];

          if (chunk.entity && chunk.entity.id === entity.id) {
            positions[entity.id] = {
              x: padding + chunk.x,
              y: padding + line.y,
              width: chunk.text.length * charWidth,
              lineIndex: lineIndex,
            };
            break;
          }
        }
      }
    });

    return positions;
  }, [entities, lineInfo]);

  // Analyze relations to count incoming/outgoing connections per entity
  const entityConnections = useMemo(() => {
    const connections = {};

    // Initialize connection info for all entities
    entities.forEach((entity) => {
      connections[entity.id] = {
        outgoing: [],
        incoming: [],
      };
    });

    // Populate with actual relations
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
    return padding * 2 + totalTextHeight + 50; // Extra padding for cross-line relations
  }, [lineInfo, baseLineSpacing]);

  // Render entity
  const renderEntity = (entity) => {
    const pos = entityPositions[entity.id];
    if (!pos) return null;

    return (
      <g key={entity.id}>
        {/* Entity background box below the text */}
        <rect
          x={pos.x}
          y={pos.y + lineHeight + 4}
          width={pos.width}
          height={20}
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
          y={pos.y + lineHeight + 16}
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

  // Render relation with smart cross-line handling
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

    // Apply offsets to connection points
    const sourceCenter = {
      x: sourcePos.x + sourcePos.width / 2 + sourceOffset,
      y: sourcePos.y + lineHeight + 24, // bottom of entity box
    };

    const targetCenter = {
      x: targetPos.x + targetPos.width / 2 + targetOffset,
      y: targetPos.y + lineHeight + 24, // bottom of entity box
    };

    const markerId = `arrow-${relation.id}`;
    let labelX, labelY;

    // Check if entities are on the same line
    if (sourcePos.lineIndex === targetPos.lineIndex) {
      // Same line - use simple arc below
      const arcHeight = 30 + index * arcSpacing;
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
    } else {
      // Different lines - create two separate path segments
      const crossLineOffset = index * 15;
      const rightEdge = containerWidth - padding;
      const leftEdge = padding;
      
      // Determine if relation is going downward or upward
      const isDownward = sourcePos.lineIndex < targetPos.lineIndex;
      
      let sourcePath, targetPath, sourceExitY, targetEntryY;
      
      if (isDownward) {
        // Downward relation: route from right edge to left edge
        sourceExitY = sourceCenter.y + 20 + crossLineOffset;
        targetEntryY = targetCenter.y + 20 + crossLineOffset;
        
        sourcePath = `M ${sourceCenter.x} ${sourceCenter.y} L ${sourceCenter.x} ${sourceExitY} L ${rightEdge} ${sourceExitY}`;
        targetPath = `M ${leftEdge} ${targetEntryY} L ${targetCenter.x} ${targetEntryY} L ${targetCenter.x} ${targetCenter.y}`;
        
        labelX = (sourceCenter.x + rightEdge) / 2;
        labelY = sourceExitY - 5;
      } else {
        // Upward relation: route from left edge to right edge
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

          {/* Source line segment */}
          <path
            d={sourcePath}
            fill="none"
            stroke={relation.color}
            strokeWidth="1.5"
          />

          {/* Target line segment with arrow */}
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
              {/* Downward: source exits right, target enters from left */}
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
              {/* Upward: source exits left, target enters from right */}
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

          {/* Label on source line */}
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
          Fixed Annotation Viewer - Entities Don't Break Across Lines
        </h3>

        {/* Width control */}
        <div className="flex items-center gap-4 mb-4">
          <label className="font-medium">Container Width:</label>
          <input
            type="range"
            min="300"
            max="800"
            value={containerWidth}
            onChange={(e) => setContainerWidth(parseInt(e.target.value))}
            className="flex-1"
          />
          <span className="text-sm font-mono w-12">{containerWidth}px</span>
        </div>
      </div>

      <div
        style={{ width: containerWidth }}
        className="border border-gray-300 overflow-hidden"
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
                  <span>
                    {entity.text} → {entity.type}
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
                    <span>
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
            <h5 className="font-medium mb-2">Line Heights & Relations:</h5>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {lineInfo.lines.map((line, index) => (
                <div
                  key={index}
                  className="p-2 bg-white rounded border text-xs"
                >
                  <div>
                    <strong>Line {index}:</strong> Y={line.y}px, Spacing=
                    {line.spacing}px
                  </div>
                  <div>
                    Relations: {line.relationCount} total (
                    {line.sameLineRelations} same-line,{" "}
                    {line.crossLineRelations} cross-line)
                  </div>
                  <div className="text-gray-600 truncate">
                    Text: "{line.chunks.map((c) => c.text).join(" ")}"
                  </div>
                </div>
              ))}
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
                      Character span: {entity.start}-{entity.end}, Line:{" "}
                      {lineNum}
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