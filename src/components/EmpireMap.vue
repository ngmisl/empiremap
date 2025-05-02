<template>
  <div class="h-full w-full">
    <div v-if="loading" class="flex h-full w-full items-center justify-center">
      <div class="text-center">
        <div class="loading loading-spinner loading-lg"></div>
        <p class="mt-2">Loading empire data...</p>
      </div>
    </div>
    
    <div v-else-if="error" class="flex h-full w-full items-center justify-center">
      <div class="alert alert-error w-full max-w-md">
        <div class="flex-1">
          <label>Error</label>
          <p>{{ error }}</p>
        </div>
      </div>
    </div>
    
    <div v-else class="empire-map-container card card-compact bg-base-100 shadow-xl relative">
      <div class="card-body">
        <h2 class="card-title text-2xl font-bold text-center">Top Empires - World Map</h2>
        
        <!-- Map Visualization Container -->
        <div class="map-visualization-container relative" ref="mapContainer">
          <!-- SVG Map Container -->
          <svg ref="svgContainer" class="empire-map w-full h-[500px] transition-all duration-300 ease-in-out" style="min-height: 500px; border: 1px solid rgba(255,255,255,0.1);"></svg>
          
          <!-- Hover Information Card - Fixed position, clean layout -->
          <div v-if="hoveredEmpire" 
               class="absolute top-4 right-4 w-64 z-10">
            <!-- Hovered Territory Details -->
            <div class="card bg-base-200 shadow-lg mb-4 overflow-hidden border border-base-300">
              <div class="card-body p-4">
                <!-- Empire name badge at top -->
                <div class="badge badge-primary mb-1 self-start">
                  {{ hoveredEmpire.token_symbol }}
                </div>
                
                <!-- Territory name - single line with ellipsis -->
                <h3 class="text-base font-bold truncate w-full" :style="{ color: hoveredTerritory?.color || '#888' }">
                  {{ hoveredEmpire.token_name }}
                </h3>
                
                <!-- Stats in a clean layout -->
                <div class="grid grid-cols-2 gap-x-2 gap-y-1 mt-2 text-sm">
                  <div class="text-opacity-70 text-sm">Territory:</div>
                  <div class="font-medium truncate">{{ hoveredTerritory?.name || 'Unknown' }}</div>
                  
                  <div class="text-opacity-70 text-sm">Treasury:</div>
                  <div class="font-semibold">${{ formatNumber(hoveredEmpire.total_distributed) }}</div>
                  
                  <div class="text-opacity-70 text-sm">Burned:</div>
                  <div class="font-medium">{{ formatNumber(hoveredEmpire.total_burned) }}</div>
                  
                  <div class="text-opacity-70 text-sm">Token:</div>
                  <div class="font-medium text-xs truncate" :title="hoveredEmpire.base_token">
                    {{ formatAddress(hoveredEmpire.base_token) }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Empire Legend - Clean design with truncated text -->
        <div class="empire-legend card bg-base-200 shadow-lg mt-4 overflow-hidden border border-base-300">
          <div class="card-body p-4">
            <h3 class="card-title text-base mb-2">Empire Legend</h3>
            <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              <div v-for="(empire, index) in empires.slice(0, 8)" :key="index" 
                   class="legend-item flex items-center gap-2 cursor-pointer hover:bg-base-300 p-1 rounded"
                   @mouseenter="handleTerritoryHover({ id: index, name: `${empire.token_name} Territory`, path: '', color: d3.schemeCategory10[index % 10], neighbors: [], empire })"
                   @mouseleave="handleTerritoryLeave">
                <div class="w-3 h-3 rounded-sm flex-shrink-0" :style="{ backgroundColor: d3.schemeCategory10[index % 10] }"></div>
                <span class="font-medium text-sm truncate" :title="empire.token_name">
                  {{ empire.token_name }}
                </span>
                <span class="text-xs opacity-70 ml-auto flex-shrink-0">${{ formatNumber(empire.total_distributed) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { z } from 'zod';
import * as d3 from 'd3';

// Define schema for empire data using Zod
const EmpireSchema = z.object({
  base_token: z.string(),
  token_name: z.string(),
  token_symbol: z.string(),
  total_distributed: z.number(),
  total_burned: z.number(),
  logo_uri: z.string(),
});

const EmpiresResponseSchema = z.object({
  empires: z.array(EmpireSchema),
  totalCount: z.number(),
  queryTime: z.number(),
  page: z.number(),
  itemsPerPage: z.number(),
});

type Empire = z.infer<typeof EmpireSchema>;

interface Territory {
  id: number;
  name: string;
  path: string;
  color: string;
  neighbors: number[];
  empire?: Empire;
}

const empires = ref<Empire[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const hoveredEmpire = ref<Empire | null>(null);
const hoveredTerritory = ref<Territory | null>(null);
const svgContainer = ref<HTMLElement | null>(null);
const mapContainer = ref<HTMLElement | null>(null);
const containerWidth = ref(0);
const containerHeight = ref(0);
const mapInitialized = ref(false);

// Format numbers for better readability
const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toLocaleString();
};

// Format token addresses for display
const formatAddress = (address: string): string => {
  if (!address || address.length < 10) return address;
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

// Handle territory hover
const handleTerritoryHover = (territory: Territory) => {
  hoveredTerritory.value = territory;
  if (territory.empire) {
    hoveredEmpire.value = territory.empire;
  }
};

// Handle mouse leaving territories
const handleTerritoryLeave = () => {
  hoveredTerritory.value = null;
  hoveredEmpire.value = null;
};

// Initialize the SVG map using D3
const initializeMap = () => {
  console.log('initializeMap called', { svgContainer: !!svgContainer.value, mapContainer: !!mapContainer.value, empireCount: empires.value.length });
  
  if (!svgContainer.value || !mapContainer.value || !empires.value.length) return;
  
  console.log('Initializing map with:', {
    containerExists: !!mapContainer.value,
    svgExists: !!svgContainer.value,
    empireCount: empires.value.length,
    firstEmpire: empires.value[0]
  });
  
  // Clear existing SVG content
  d3.select(svgContainer.value).selectAll('*').remove();
  
  // Get container dimensions for responsive sizing
  const containerRect = mapContainer.value.getBoundingClientRect();
  console.log('Container dimensions:', containerRect.width, 'x', containerRect.height);
  containerWidth.value = containerRect.width;
  containerHeight.value = 500; // Fixed height for consistency
  
  // Create SVG element with responsive dimensions
  const svg = d3.select(svgContainer.value)
    .attr('width', containerWidth.value)
    .attr('height', containerHeight.value)
    .attr('viewBox', '-400 -200 800 400')
    .attr('preserveAspectRatio', 'xMidYMid meet');
    
  // Add definitions for filters and patterns
  const defs = svg.append('defs');
  
  // Add glow filter for highlighting
  const glow = defs.append('filter')
    .attr('id', 'glow')
    .attr('x', '-30%')
    .attr('y', '-30%')
    .attr('width', '160%')
    .attr('height', '160%');
    
  glow.append('feGaussianBlur')
    .attr('stdDeviation', '5')
    .attr('result', 'blur');
    
  glow.append('feComposite')
    .attr('in', 'SourceGraphic')
    .attr('in2', 'blur')
    .attr('operator', 'over');
    
  // Add neighbor glow filter (more subtle)
  const neighborGlow = defs.append('filter')
    .attr('id', 'neighborGlow')
    .attr('x', '-20%')
    .attr('y', '-20%')
    .attr('width', '140%')
    .attr('height', '140%');
    
  neighborGlow.append('feGaussianBlur')
    .attr('stdDeviation', '2')
    .attr('result', 'blur');
    
  neighborGlow.append('feComposite')
    .attr('in', 'SourceGraphic')
    .attr('in2', 'blur')
    .attr('operator', 'over');
  
  // Add pattern for background texture
  defs.append('pattern')
    .attr('id', 'gridPattern')
    .attr('width', 20)
    .attr('height', 20)
    .attr('patternUnits', 'userSpaceOnUse')
    .append('path')
    .attr('d', 'M 20 0 L 0 0 0 20')
    .attr('fill', 'none')
    .attr('stroke', 'rgba(200, 200, 200, 0.15)')
    .attr('stroke-width', 0.5);
  
  // Add background
  svg.append('rect')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('fill', 'var(--bg-color, #1a202c)')
    .attr('class', 'map-background');
    
  svg.append('rect')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('fill', 'url(#gridPattern)')
    .attr('class', 'map-grid');
  
  // Create the map container group and center it in the viewBox
  const mapGroup = svg.append('g')
    .attr('class', 'map-group')
    .attr('transform', 'scale(1)');
  
  // Debug rendering of map
  mapGroup.append('rect')
    .attr('x', -300)
    .attr('y', -200)
    .attr('width', 600)
    .attr('height', 400)
    .attr('fill', 'none')
    .attr('stroke', 'red')
    .attr('stroke-width', 1)
    .attr('stroke-dasharray', '5,5');

  // Add 8 visible territory markers (for debugging)
  [
    [0, 0], [120, 0], [240, 0], 
    [0, 120], [120, 120],
    [-120, 0], [-240, 0], 
    [0, -120]
  ].forEach((pos, i) => {
    mapGroup.append('circle')
      .attr('cx', pos[0])
      .attr('cy', pos[1])
      .attr('r', 10)
      .attr('fill', '#ff0000')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2);
  });
  
  // Calculate metrics for sizing
  const totalDistributed = empires.value.reduce((sum, e) => sum + e.total_distributed, 0);
  
  // Limit to top 8 empires for world map
  const topEmpires = empires.value.slice(0, 8);
  
  // Define territory shapes that look more natural with irregular territories
  // These are custom SVG paths designed to form a natural-looking world map
  // Note: Coordinates are centered around (0,0) now that we're using a transform/translate
  const territoryShapes = [
    // Simple rectangular shapes positioned in a grid for maximum visibility
    { path: "M-50,-50 h100 v100 h-100 z", centroid: { x: 0, y: 0 }, connections: [1, 3, 4] },     // Center
    { path: "M-50,-50 h100 v100 h-100 z", centroid: { x: 120, y: 0 }, connections: [0, 2] },   // Right
    { path: "M-50,-50 h100 v100 h-100 z", centroid: { x: 240, y: 0 }, connections: [1] },      // Far Right
    { path: "M-50,-50 h100 v100 h-100 z", centroid: { x: 0, y: 120 }, connections: [0, 4] },  // Bottom
    { path: "M-50,-50 h100 v100 h-100 z", centroid: { x: 120, y: 120 }, connections: [0, 3] }, // Bottom Right
    { path: "M-50,-50 h100 v100 h-100 z", centroid: { x: -120, y: 0 }, connections: [0, 6] }, // Left
    { path: "M-50,-50 h100 v100 h-100 z", centroid: { x: -240, y: 0 }, connections: [5] },    // Far Left
    { path: "M-50,-50 h100 v100 h-100 z", centroid: { x: 0, y: -120 }, connections: [0] }    // Top
   ];
  
  // Create territory objects with empires
  const territories: {
    id: number;
    path: string;
    centroid: { x: number, y: number };
    connections: number[];
    empire: Empire;
    scale: number;
    color: string;
  }[] = [];
  
  // Assign empires to territories and calculate scales
  for (let i = 0; i < Math.min(topEmpires.length, territoryShapes.length); i++) {
    const empire = topEmpires[i];
    const shape = territoryShapes[i];
    
    // Calculate scale based on economic power
    const distributedPortion = empire.total_distributed / totalDistributed;
    const minScale = 0.8; // Minimum scale to ensure visibility
    const scale = minScale + (distributedPortion * 1.5); // More modest scaling to prevent overlap
    
    const color = d3.schemeCategory10[i % 10];
    console.log(`Assigning color ${color} to ${empire.token_name}`);
    
    territories.push({
      id: i,
      path: shape.path,
      centroid: shape.centroid,
      connections: shape.connections,
      empire: empire,
      scale: scale,
      color: color
    });
  }
  
  console.log('Territories created:', territories.length, territories);
  
  // Draw connection lines between territories
  const linksGroup = mapGroup.append('g').attr('class', 'territory-connections');
  
  const connections: { source: number, target: number }[] = [];
  
  // Create unique connections
  for (const territory of territories) {
    console.log(`Processing connections for territory ${territory.id} (${territory.empire.token_symbol})`, territory.connections);
    for (const connectedId of territory.connections) {
      if (connectedId < territory.id) { // Only add one connection between territories
        connections.push({
          source: territory.id,
          target: connectedId
        });
      }
    }
  }
  
  console.log('All connections:', connections);
  
  // Draw connections
  for (const connection of connections) {
    const source = territories[connection.source];
    const target = territories[connection.target];
    
    if (!source || !target) {
      console.warn('Invalid connection:', connection);
      continue;
    }
    
    console.log(`Drawing connection from ${source.empire.token_symbol} to ${target.empire.token_symbol}`);
    
    linksGroup.append('line')
      .attr('x1', source.centroid.x)
      .attr('y1', source.centroid.y)
      .attr('x2', target.centroid.x)
      .attr('y2', target.centroid.y)
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 3)
      .attr('opacity', 0.6)
      .attr('stroke-dasharray', '5,5');
  }
  
  // Draw territories
  const territoriesGroup = mapGroup.append('g').attr('class', 'territories');
  
  // Sort by scale for proper layering (draw larger territories first)
  territories.sort((a, b) => b.scale - a.scale);
  
  for (const territory of territories) {
    console.log('Rendering territory:', territory.id, territory);
    // Create a group for this territory and position it
    const territoryGroup = territoriesGroup.append('g')
      .attr('id', `territory-${territory.id}`)
      .attr('transform', `translate(${territory.centroid.x}, ${territory.centroid.y})`)
      .style('cursor', 'pointer')
      .style('opacity', '1')
      .on('mouseenter', () => {
        // Highlight this territory
        d3.select(`#territory-${territory.id}`)
          .select('path')
          .transition()
          .duration(200)
          .attr('stroke', '#fff')
          .attr('stroke-width', 2)
          .attr('filter', 'url(#glow)');
        
        // Highlight connected territories
        for (const connectedId of territory.connections) {
          if (connectedId < territories.length) {
            d3.select(`#territory-${connectedId}`)
              .select('path')
              .transition()
              .duration(200)
              .attr('stroke', '#ccc')
              .attr('stroke-width', 1.5)
              .attr('filter', 'url(#neighborGlow)');
          }
        }
        
        // Update UI with empire details
        hoveredEmpire.value = territory.empire;
        hoveredTerritory.value = {
          id: territory.id,
          name: `${territory.empire.token_name} Territory`,
          path: '',
          color: territory.color,
          neighbors: territory.connections,
          empire: territory.empire
        };
      })
      .on('mouseleave', () => {
        // Reset all territories
        for (const t of territories) {
          d3.select(`#territory-${t.id}`)
            .select('path')
            .transition()
            .duration(200)
            .attr('stroke', '#333')
            .attr('stroke-width', 1.5)
            .attr('filter', 'none');
        }
        
        // Reset UI
        hoveredEmpire.value = null;
        hoveredTerritory.value = null;
      });
    
    // Create territory path
    territoryGroup.append('path')
      .attr('d', territory.path)
      .attr('fill', territory.color)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .attr('stroke-linejoin', 'round')
      .attr('opacity', 1)
      .attr('pointer-events', 'visiblePainted');
      
    console.log('Added territory path for:', territory.empire.token_symbol, 'with color:', territory.color);
    
    // Create label container separate from path scaling
    const labelContainer = territoryGroup.append('g')
      .attr('class', 'territory-label-container')
      .attr('transform', 'translate(0, 0)'); // Centered on territory
      
    // Add a transparent background to make text more readable
    labelContainer.append('rect')
      .attr('x', -40)
      .attr('y', -15)
      .attr('width', 80)
      .attr('height', 35)
      .attr('fill', 'rgba(0,0,0,0.5)')
      .attr('rx', 4);
    
    // Add territory name with proper spacing - not affected by territory scaling
    // Use token symbol instead of full name to avoid overlapping
    const tokenSymbol = territory.empire.token_symbol;
    // Determine appropriate font size based on text length
    const symbolLength = tokenSymbol.length;
    const fontSize = symbolLength > 6 ? 10 : symbolLength > 4 ? 11 : 12;
    
    labelContainer.append('text')
      .attr('class', 'territory-name')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('y', -10)
      .attr('fill', '#fff')
      .attr('font-weight', 'bold')
      .attr('font-size', `${fontSize}px`)
      .attr('pointer-events', 'none')
      .text(tokenSymbol);
    
    // Add value label below the name with more spacing
    labelContainer.append('text')
      .attr('class', 'territory-value')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('y', 10)
      .attr('fill', '#fff')
      .attr('font-size', '9px')
      .attr('opacity', 0.9)
      .attr('pointer-events', 'none')
      .text(`$${formatNumber(territory.empire.total_distributed)}`);
  }
  
  // Add a legend for size reference
  const legendGroup = svg.append('g')
    .attr('class', 'size-legend')
    .attr('transform', 'translate(50, 750)');
  
  legendGroup.append('text')
    .attr('x', 0)
    .attr('y', 0)
    .attr('fill', '#fff')
    .attr('opacity', '0.7')
    .attr('font-size', '14px')
    .text('Territory size = Treasury value');
  
  mapInitialized.value = true;
};

// Fetch empire data
const fetchEmpires = async () => {
  loading.value = true;
  error.value = null;

  try {
    // Always fetch via AllOrigins CORS proxy to ensure JSON response
    const endpoint = 'https://www.empirebuilder.world/api/top-empires?limit=8';
    const apiUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(endpoint)}`;
    console.log('Fetching empire data via AllOrigins proxy:', apiUrl);
    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Raw API response:', data);
    
    if (!data.empires || !Array.isArray(data.empires)) {
      console.error('API response missing empires array:', data);
      throw new Error('Invalid API format: missing empires array');
    }
    
    const parsed = EmpiresResponseSchema.parse(data);
    console.log('Parsed empire data:', parsed);
    empires.value = parsed.empires;
    console.log('Empire data stored:', empires.value);
    initializeMap();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error occurred';
    console.error('Error fetching empire data:', err);
  } finally {
    loading.value = false;
  }
};

// Handle window resize for responsive map
const handleResize = () => {
  if (mapInitialized.value) {
    initializeMap();
  }
};

// Initialize on component mount
onMounted(() => {
  fetchEmpires();
  
  // Add resize event listener for responsiveness
  window.addEventListener('resize', handleResize);
  
  // Initialize theme watcher to handle dark/light mode changes
  const observer = new MutationObserver(() => {
    const darkMode = document.documentElement.getAttribute('data-theme') === 'dark';
    if (svgContainer.value) {
      svgContainer.value.classList.toggle('dark-mode', darkMode);
    }
    
    // Reinitialize map to apply theme changes
    if (mapInitialized.value) {
      initializeMap();
    }
  });
  
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  });
  
  // Cleanup function
  return () => {
    window.removeEventListener('resize', handleResize);
    observer.disconnect();
  };
});
</script>

<style scoped>
.empire-map-container {
  max-width: 1200px;
  margin: 0 auto;
}

.territory-path {
  transition: opacity 0.3s ease, stroke-width 0.3s ease, filter 0.3s ease;
}

.territory-path:hover {
  opacity: 0.9;
}

.empire-info {
  z-index: 10;
  transition: all 0.3s ease;
}

.map-background {
  transition: fill 0.3s ease;
}

/* Dark mode specific styling */
:root[data-theme="dark"] .map-background {
  --bg-color: #1a202c;
}

:root[data-theme="light"] .map-background {
  --bg-color: #e0f7fa;
}

/* Mobile optimization */
@media (max-width: 768px) {
  .empire-legend .grid {
    grid-template-columns: 1fr 1fr;
  }
  
  .empire-info {
    max-width: 250px !important;
  }
  
  .stat-item .stat-value {
    font-size: 0.75rem;
  }
}
</style>
