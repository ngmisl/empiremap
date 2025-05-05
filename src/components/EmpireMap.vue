<template>
  <div class="empire-map-container p-4">
    <!-- Loading Indicator -->
    <div v-if="loading" class="loading-overlay flex flex-col items-center justify-center p-6 rounded-lg">
      <div class="loading animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mb-4"></div>
      <p class="text-base-content/70">Loading Empire Data...</p>
      <progress class="progress w-56 mt-2" max="100"></progress>
    </div>
    
    <!-- Error Message -->
    <div v-else-if="error" class="error-overlay bg-base-200 p-6 rounded-lg">
      <div class="alert alert-error mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <span>{{ error }}</span>
      </div>
      <button @click="fetchEmpires" class="btn btn-secondary">Retry</button>
    </div>
    
    <!-- Map Container -->
    <div v-else class="relative flex flex-col md:flex-row gap-4">
      <!-- Main Map -->
      <div ref="mapContainer" class="w-full max-w-full aspect-[4/3] bg-base-200 shadow-inner overflow-hidden rounded-lg border-2 border-[#8B6B4C] relative">
        <svg ref="svgRef" :viewBox="viewBox" class="w-full h-full" preserveAspectRatio="xMidYMid meet"></svg>
      
        <!-- Hover information card - medieval parchment style -->
        <div 
          v-if="hoveredEmpire" 
          class="hover-info absolute top-4 left-4 w-64 p-3 rounded-md shadow-xl z-10"
          style="background-color: #f9f3e2; border: 2px solid #5d4037; font-family: serif;"
        >
          <div class="grid gap-1">
            <div class="text-lg font-semibold flex items-center" style="color: #5d4037;">
              <span class="truncate flex-1">{{ hoveredEmpire.token_name }}</span>
            </div>
            <div class="text-sm opacity-80" style="color: #5d4037;">
              Token: {{ formatShortAddress(hoveredEmpire.base_token) }}
            </div>
            <div class="grid grid-cols-2 text-xs gap-x-1" style="color: #5d4037;">
              <div class="font-medium">Treasury:</div>
              <div class="text-right">${{ formatNumber(hoveredEmpire.total_distributed) }}</div>
              
              <div class="font-medium">Burned:</div>
              <div class="text-right">{{ formatNumber(hoveredEmpire.total_burned) }}</div>
              
              <div class="font-medium">Symbol:</div>
              <div class="text-right">{{ hoveredEmpire.token_symbol }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Legend on the right side of the map -->
      <div v-if="mapGenerated && empires.length > 0" class="empire-legend md:w-48 lg:w-56 bg-[#f9f3e2] p-3 rounded-lg shadow-md border border-[#8B6B4C] self-start">
        <h3 class="text-base font-serif font-semibold mb-2 text-[#5D4037]">Empire Legend</h3>
        <div class="flex flex-col gap-2">
          <div 
            v-for="(empire, index) in empires" 
            :key="empire.token_name"
            class="flex items-center gap-1 p-1 rounded hover:bg-[#e9e3d2] cursor-pointer"
            @mouseenter="handleRegionHover(empire, index)"
            @mouseleave="handleTerritoryLeave"
          >
            <div 
              class="w-4 h-4 border-2 shadow-sm rounded-sm flex-shrink-0"
              style="background-color: #f9f3e2; border-color: #5d4037;" 
            ></div>
            <span class="text-xs font-serif truncate text-[#5D4037]">{{ empire.token_name }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import * as d3 from 'd3';
import { Delaunay } from 'd3-delaunay';
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { z } from 'zod';
import type { Empire } from '../schemas/empireSchema';
import { formatZodError, EmpiresResponseSchema } from '../schemas/empireSchema';

// SVG and Map state
const empires = ref<Empire[]>([]);
const svgRef = ref<SVGElement | null>(null);
const mapContainer = ref<HTMLDivElement | null>(null);
const viewBox = ref('0 0 1000 750'); // Larger default size for better visibility
const loading = ref(true);
const error = ref<string | null>(null);
const hoveredEmpire = ref<Empire | null>(null);
const mapGenerated = ref(false);
const themeObserver = ref<MutationObserver | null>(null);

// Format numbers for better readability
const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(2)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(2)}K`;
  }
  return num.toFixed(2);
};

// Format address for display
const formatShortAddress = (address: string): string => {
  if (!address || address.length < 10) return address;
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

// Update the SVG viewBox based on container dimensions
const updateViewBox = () => {
  if (!mapContainer.value || !svgRef.value) return;
  
  // Fixed viewBox size for better visibility
  viewBox.value = '0 0 1000 750';
  
  // Also update the SVG size to fill container
  if (svgRef.value) {
    const containerWidth = mapContainer.value.clientWidth;
    const containerHeight = mapContainer.value.clientHeight;
    svgRef.value.setAttribute('width', `${containerWidth}px`);
    svgRef.value.setAttribute('height', `${containerHeight}px`);
  }
};

// Initialize the map
const initializeMap = () => {
  if (!svgRef.value || !mapContainer.value) return;
  
  // Fixed size for the map viewBox
  const width = 1000;
  const height = 750;
  
  // Select SVG element with d3
  const svg = d3.select(svgRef.value);
  
  // Clear existing content
  svg.selectAll('*').remove();
  
  try {
    // Ensure we have the patterns and filters
    ensureFiltersAndPatterns(svg);
    
    // Draw the landmass first
    const landmass = drawLandmass(svg, width, height);
    
    // Draw territories on the landmass
    if (landmass) {
      drawVoronoiRegions(svg, width, height);
    }
  } catch (err) {
    console.error('Error generating map visualization:', err);
    
    // Create a simpler fallback visualization
    createTemporaryVisualization(svg, width, height);
  }
};

// Define handlers for interacting with regions
const handleRegionHover = (empire: Empire, index: number) => {
  // Set the hovered empire
  hoveredEmpire.value = empire;
  
  // If we have SVG regions, highlight the current region
  if (svgRef.value) {
    const svg = d3.select(svgRef.value) as d3.Selection<SVGElement, unknown, null, undefined>;
    
    // Reset opacity for all regions first
    svg.selectAll('.region')
      .attr('fill-opacity', 0.7)
      .attr('stroke-width', 1);
    
    // Highlight the current region
    svg.select(`.region-${index}`)
      .attr('fill-opacity', 0.9)
      .attr('stroke-width', 2.5);
  }
};

const handleTerritoryLeave = () => {
  // Clear the hovered empire
  hoveredEmpire.value = null;
  
  // If we have SVG regions, reset all regions to default style
  if (svgRef.value) {
    const svg = d3.select(svgRef.value) as d3.Selection<SVGElement, unknown, null, undefined>;
    
    // Reset all regions to default style
    svg.selectAll('.region')
      .attr('fill-opacity', 0.7)
      .attr('stroke-width', 1);
  }
};

// Generate an irregular island-like landmass shape
const generateLandmass = (width: number, height: number): string => {
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.4;
  
  // Number of points to create the irregular polygon
  const numPoints = 24;
  
  // Generate points around a circle with random variance
  const points: [number, number][] = [];
  
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * 2 * Math.PI;
    // Add randomness to radius to create irregular edges
    // More pronounced variance for that hand-drawn RPG map feel
    const variance = 0.8 + Math.random() * 0.4;
    const pointRadius = radius * variance;
    
    points.push([
      centerX + Math.cos(angle) * pointRadius,
      centerY + Math.sin(angle) * pointRadius
    ]);
  }
  
  // Close the path
  points.push(points[0]);
  
  // Create a line generator
  const lineGenerator = d3.line<[number, number]>()
    .x(d => d[0])
    .y(d => d[1])
    .curve(d3.curveBasisClosed); // Use basis curve for more natural, hand-drawn look
  
  // Generate the path data
  return lineGenerator(points) || '';
};

// Fetch empire data
const fetchEmpires = async () => {
  loading.value = true;
  error.value = null;

  try {
    // Define endpoint as per PRD requirements - limit=10 for top 10 empires
    const endpoint = 'https://www.empirebuilder.world/api/top-empires?limit=10&page=1';
    
    // Use CORS proxy for browser compatibility in static hosting
    const corsProxyURL = 'https://api.allorigins.win/raw?url=';
    const targetURL = encodeURIComponent(endpoint);
    const proxyURL = `${corsProxyURL}${targetURL}`;
    
    const response = await fetch(proxyURL);
    
    if (!response.ok) {
      console.error(`API request failed with status: ${response.status}`);
      throw new Error(`Failed to fetch data: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data || !data.empires) {
      console.error('API returned invalid data structure:', data);
      throw new Error('Invalid API response format - missing empires data');
    }
    
    try {
      // Validate data against schema
      const parsedData = EmpiresResponseSchema.parse(data);
      empires.value = parsedData.empires; // Access the empires array from response
      
      console.log(`Loaded ${empires.value.length} empires data`);
      
      // If we have less than 10 empires, log a warning
      if (empires.value.length < 10) {
        console.warn(`Expected 10 empires but received only ${empires.value.length}`);
      }
      
      // Initialize map after a small delay to ensure DOM elements are ready
      setTimeout(() => {
        if (svgRef.value && mapContainer.value) {
          initializeMap();
        }
      }, 100);
    } catch (validationError) {
      // Handle validation errors
      if (validationError instanceof z.ZodError) {
        const formattedError = formatZodError(validationError);
        console.error('Validation error:', formattedError);
        throw new Error(`Data validation failed: ${formattedError}`);
      }
      // Re-throw other errors
      throw validationError;
    }
  } catch (err) {
    console.error('Error fetching or parsing empire data:', err);
    error.value = err instanceof Error ? err.message : 'Unknown error occurred';
  } finally {
    loading.value = false;
  }
};

// Handle window resize for responsiveness
const handleResize = () => {
  if (!mapContainer.value || !svgRef.value) return;
  
  updateViewBox();
  
  // Re-initialize map if data is loaded
  if (empires.value.length > 0) {
    initializeMap();
  }
};

// Ensure we have filters and patterns for medieval styling
const ensureFiltersAndPatterns = (svg: d3.Selection<SVGElement, unknown, null, undefined>) => {
  // Check if we already have a defs element
  let defs = svg.select('defs') as d3.Selection<SVGDefsElement, unknown, null, undefined>;
  if (defs.empty()) {
    defs = svg.append('defs') as d3.Selection<SVGDefsElement, unknown, null, undefined>;
  }
  
  // Create parchment pattern if it doesn't exist
  if (defs.select('#parchment-pattern').empty()) {
    const pattern = defs.append('pattern')
      .attr('id', 'parchment-pattern')
      .attr('patternUnits', 'userSpaceOnUse')
      .attr('width', 200)
      .attr('height', 200);
      
    // Parchment base
    pattern.append('rect')
      .attr('width', 200)
      .attr('height', 200)
      .attr('fill', '#f9f3e2');
      
    // Add subtle texture to the parchment
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * 200;
      const y = Math.random() * 200;
      pattern.append('circle')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', Math.random() * 1.5)
        .attr('fill', '#d4c4a0')
        .attr('opacity', Math.random() * 0.3);
    }
    
    // Add subtle stains to the parchment for age effect
    for (let i = 0; i < 5; i++) {
      const x = Math.random() * 200;
      const y = Math.random() * 200;
      const size = 20 + Math.random() * 30;
      
      pattern.append('circle')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', size)
        .attr('fill', '#d4b682')
        .attr('opacity', 0.1 + Math.random() * 0.1);
    }
  }
  
  // Create a clipPath for the landmass
  if (defs.select('#landmass-clip').empty()) {
    defs.append('clipPath')
      .attr('id', 'landmass-clip');
  }
  
  // Create water pattern
  if (defs.select('#water-pattern').empty()) {
    const pattern = defs.append('pattern')
      .attr('id', 'water-pattern')
      .attr('patternUnits', 'userSpaceOnUse')
      .attr('width', 200)
      .attr('height', 200);
      
    // Water base
    pattern.append('rect')
      .attr('width', 200)
      .attr('height', 200)
      .attr('fill', '#cad9e6');
      
    // Add wave lines
    for (let i = 0; i < 10; i++) {
      const yPos = i * 20;
      pattern.append('path')
        .attr('d', `M0,${yPos + 10} Q50,${yPos} 100,${yPos + 10} T200,${yPos + 10}`)
        .attr('stroke', '#abc7de')
        .attr('stroke-width', 1.5)
        .attr('fill', 'none')
        .attr('opacity', 0.5);
    }
  }
};

// Draw the landmass on the map
const drawLandmass = (svg: d3.Selection<SVGElement, unknown, null, undefined>, width: number, height: number) => {
  // Generate the landmass shape
  const landmassPath = generateLandmass(width, height);
  
  // Check if landmass already exists
  let landmass = svg.select<SVGPathElement>('.landmass');
  
  if (landmass.empty()) {
    // Create landmass with medieval style
    const pathElement = svg.append('path')
      .attr('class', 'landmass')
      .attr('d', landmassPath)
      .attr('fill', 'url(#parchment-pattern)')
      .attr('stroke', '#8B6B4C')
      .attr('stroke-width', 3)
      .attr('filter', 'drop-shadow(3px 3px 3px rgba(0, 0, 0, 0.3))')
      .style('opacity', 0);
      
    // Add transition effect
    pathElement.transition()
      .duration(1000)
      .style('opacity', 1);
      
    landmass = svg.select<SVGPathElement>('.landmass');
    
    // Update clipPath for landmass
    svg.select('#landmass-clip')
      .append('path')
      .attr('d', landmassPath);
      
    // Add a subtle outer glow for a hand-drawn effect
    svg.append('path')
      .attr('class', 'landmass-outline')
      .attr('d', landmassPath)
      .attr('fill', 'none')
      .attr('stroke', '#5D4037')
      .attr('stroke-width', 5)
      .attr('stroke-opacity', 0.2)
      .attr('filter', 'blur(3px)');
    
    // Add a water background (the sea)
    svg.insert('rect', '.landmass')
      .attr('class', 'map-background')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'url(#water-pattern)');
      
    // Add a compass rose to the bottom right
    const compassSize = Math.min(width, height) * 0.12;
    const compassX = width * 0.85;
    const compassY = height * 0.85;
    
    const compass = svg.append('g')
      .attr('class', 'compass')
      .attr('transform', `translate(${compassX}, ${compassY})`);
      
    // Background circle
    compass.append('circle')
      .attr('r', compassSize)
      .attr('fill', '#f9f3e2')
      .attr('stroke', '#8B6B4C')
      .attr('stroke-width', 2);
      
    // Direction lines
    const directions = [
      { angle: 0, label: 'E' },
      { angle: 90, label: 'S' },
      { angle: 180, label: 'W' },
      { angle: 270, label: 'N' }
    ];
    
    for (const dir of directions) {
      // Main direction line
      compass.append('line')
        .attr('x1', 0)
        .attr('y1', 0)
        .attr('x2', compassSize * 0.8 * Math.cos(dir.angle * Math.PI / 180))
        .attr('y2', compassSize * 0.8 * Math.sin(dir.angle * Math.PI / 180))
        .attr('stroke', '#5D4037')
        .attr('stroke-width', 2);
        
      // Direction label
      compass.append('text')
        .attr('x', compassSize * 0.9 * Math.cos(dir.angle * Math.PI / 180))
        .attr('y', compassSize * 0.9 * Math.sin(dir.angle * Math.PI / 180))
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-family', 'serif')
        .attr('font-size', compassSize * 0.2)
        .attr('fill', '#5D4037')
        .text(dir.label);
    }
    
    // Add a decorative border to the map
    const borderWidth = 10;
    svg.append('rect')
      .attr('x', borderWidth / 2)
      .attr('y', borderWidth / 2)
      .attr('width', width - borderWidth)
      .attr('height', height - borderWidth)
      .attr('fill', 'none')
      .attr('stroke', '#8B6B4C')
      .attr('stroke-width', borderWidth)
      .attr('rx', 5)
      .attr('ry', 5);
      
    // Add some decorative elements to the corners for medieval map feel
    const corners = [
      { x: borderWidth * 2, y: borderWidth * 2 },
      { x: width - borderWidth * 2, y: borderWidth * 2 },
      { x: width - borderWidth * 2, y: height - borderWidth * 2 },
      { x: borderWidth * 2, y: height - borderWidth * 2 }
    ];
    
    for (const corner of corners) {
      svg.append('circle')
        .attr('cx', corner.x)
        .attr('cy', corner.y)
        .attr('r', borderWidth)
        .attr('fill', '#5D4037')
        .attr('stroke', '#8B6B4C')
        .attr('stroke-width', 1);
    }
  } else {
    // Update existing landmass
    landmass
      .attr('d', landmassPath);
      
    // Update clipPath for landmass
    svg.select('#landmass-clip path')
      .attr('d', landmassPath);
      
    // Update outline
    svg.select('.landmass-outline')
      .attr('d', landmassPath);
  }
  
  mapGenerated.value = true;
  return landmass;
};

// Generate Voronoi regions for territories
const generateVoronoiRegions = (width: number, height: number, numPoints: number): [number, number][] => {
  // Scale points based on economic values
  const points: [number, number][] = [];
  
  // Calculate total economic value for distribution calculations
  const totalEconomicValue = empires.value.reduce((sum, empire) => sum + (empire.total_distributed || 1), 0);
  
  // Base distribution is circular with bias toward center, but we'll adjust based on economic values
  const baseDistribution = [];
  for (let i = 0; i < numPoints; i++) {
    // Create a base point distribution in a circle
    const angle = (i / numPoints) * 2 * Math.PI;
    baseDistribution.push(angle);
  }
  
  // Sort empires by economic value (descending) so larger empires get processed first
  const sortedEmpires = [...empires.value].sort((a, b) => 
    (b.total_distributed || 0) - (a.total_distributed || 0)
  );
  
  // Larger territories are placed closer to the center for better visibility
  for (let i = 0; i < sortedEmpires.length && i < numPoints; i++) {
    const empire = sortedEmpires[i];
    const angle = baseDistribution[i];
    
    // Calculate territory size as percentage of total economy
    const economicRatio = (empire.total_distributed || 1) / totalEconomicValue;
    
    // Large territories closer to center, small ones toward edge
    // Scale distance from center inversely proportional to economic value
    const distanceFactor = 1 - (economicRatio * 0.7); // 0.3 to 1.0
    const distanceFromCenter = distanceFactor * 0.45 * Math.min(width, height);
    
    // Calculate position
    const x = width / 2 + Math.cos(angle) * distanceFromCenter;
    const y = height / 2 + Math.sin(angle) * distanceFromCenter;
    points.push([x, y]);
  }
  
  return points;
};

// Find optimal label position within territory polygon
const findOptimalLabelPosition = (
  polygon: Array<[number, number]>, 
  centroid: [number, number],
  width: number,
  height: number
): { x: number, y: number, maxWidth: number } => {
  // Start with centroid as default position
  let [x, y] = centroid;
  
  // Create a bounding box for the polygon
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  
  for (const point of polygon) {
    minX = Math.min(minX, point[0]);
    minY = Math.min(minY, point[1]);
    maxX = Math.max(maxX, point[0]);
    maxY = Math.max(maxY, point[1]);
  }
  
  // Define padding and boundary constraints to keep labels fully within territories
  const padding = 15; // Increased padding from edge
  const boxWidth = maxX - minX;
  const boxHeight = maxY - minY;
  
  // Set maximum label width to prevent overlap with borders
  let maxWidth = Math.min(boxWidth - padding * 2, 120);
  
  // Ensure minimum width for very small territories
  maxWidth = Math.max(maxWidth, 40);
  
  // Check if territory is large enough for a label
  if (boxWidth >= 70 && boxHeight >= 30) {
    // Territory is big enough, use the centroid
    // But adjust to ensure we're not too close to edges
    x = Math.max(minX + padding + maxWidth/2, Math.min(maxX - padding - maxWidth/2, x));
    y = Math.max(minY + padding + 12, Math.min(maxY - padding - 12, y));
  } else {
    // For small territories, position at center
    x = minX + boxWidth/2;
    y = minY + boxHeight/2;
    
    // Smaller labels for small territories
    maxWidth = Math.min(maxWidth, boxWidth - 15);
  }
  
  // Final safety check - ensure label stays within map bounds
  const mapPadding = 15;
  x = Math.max(maxWidth/2 + mapPadding, Math.min(width - maxWidth/2 - mapPadding, x));
  y = Math.max(24 + mapPadding, Math.min(height - 24 - mapPadding, y));
  
  return { x, y, maxWidth };
};

// Calculate ideal text length for display
const getTruncatedName = (name: string, maxWidth: number): string => {
  if (!name) return 'Unknown';
  
  // Character width approximation
  const charWidth = 7; // Approximate width of each character in pixels
  
  // Calculate max characters that can fit
  const maxChars = Math.floor(maxWidth / charWidth);
  
  if (maxChars < 2) return ''; // Hide text if too small
  if (maxChars < 4) return name.substring(0, 2); // First two letters if very small
  if (name.length <= maxChars) return name; // Full name if it fits
  
  // Truncate with ellipsis
  return `${name.substring(0, maxChars - 3)}...`;
};

// Draw Voronoi regions on the map
const drawVoronoiRegions = (
  svg: d3.Selection<SVGElement, unknown, null, undefined>,
  width: number,
  height: number
) => {
  if (!empires.value.length) return;
  
  // Clear existing territories
  svg.selectAll('.territory-path').remove();
  svg.selectAll('.territory-label').remove();
  
  // Generate points for territories - one per empire
  const points = generateVoronoiRegions(width, height, empires.value.length);
  
  // Create Delaunay triangulation, then Voronoi diagram
  const delaunay = Delaunay.from(points);
  const voronoi = delaunay.voronoi([0, 0, width, height]);
  
  // Get clipPath for constraining territories to the landmass
  const clipPathId = 'landmass-clip';
  
  // Draw each territory with medieval-style borders
  const territories = svg.append('g')
    .attr('class', 'territories')
    .attr('clip-path', `url(#${clipPathId})`);
    
  // Create a separate label group (not clipped) to ensure labels are visible
  const labels = svg.append('g')
    .attr('class', 'territory-labels')
    .attr('clip-path', `url(#${clipPathId})`); // Apply clip path to keep labels inside the landmass
  
  // Color palette for territories - using earthy, muted tones suitable for medieval maps
  const colorPalette = [
    '#D5BF86', '#C8B275', '#D2B48C', '#C4AD70', 
    '#BEA36E', '#D3C8A8', '#C5B892', '#CABF9A',
    '#CEC5A7', '#D1BC8E', '#C1AE80', '#B8A27A'
  ];
  
  // Linearly interpolate between two colors
  const interpolateColor = (color1: string, color2: string, factor: number): string => {
    const r1 = Number.parseInt(color1.substring(1, 3), 16);
    const g1 = Number.parseInt(color1.substring(3, 5), 16);
    const b1 = Number.parseInt(color1.substring(5, 7), 16);
    
    const r2 = Number.parseInt(color2.substring(1, 3), 16);
    const g2 = Number.parseInt(color2.substring(3, 5), 16);
    const b2 = Number.parseInt(color2.substring(5, 7), 16);
    
    const r = Math.round(r1 + (r2 - r1) * factor);
    const g = Math.round(g1 + (g2 - g1) * factor);
    const b = Math.round(b1 + (b2 - b1) * factor);
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  };
  
  // Create and draw territories for each empire
  for (const [index, empire] of empires.value.entries()) {
    const cellPolygon = voronoi.cellPolygon(index);
    if (!cellPolygon) continue;
    
    // Get color from palette or use default
    const baseColor = colorPalette[index % colorPalette.length];
    
    // Adjust color slightly for variance while keeping it muted
    const variantFactor = 0.1 + Math.random() * 0.2; // Small random adjustment
    const fillColor = interpolateColor(baseColor, '#f9f3e2', variantFactor);
    
    // Calculate centroid for label placement
    const centroid = calculateCentroid(cellPolygon);
    
    // Create territory with medieval styling
    const pathData = `M${cellPolygon.join('L')}Z`;
    
    // Add the territory
    territories.append('path')
      .datum(empire)
      .attr('class', 'territory-path')
      .attr('d', pathData)
      .attr('fill', fillColor)
      .attr('stroke', '#5D4037')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.7)
      .attr('data-index', index)
      .on('mouseenter', () => handleRegionHover(empire, index))
      .on('mouseleave', handleTerritoryLeave);
      
    // Add a decorative icon or seal to the territory
    territories.append('circle')
      .attr('cx', centroid[0])
      .attr('cy', centroid[1])
      .attr('r', 8)
      .attr('fill', '#C09A64')
      .attr('stroke', '#5D4037')
      .attr('stroke-width', 1);
      
    // Add a simple abbreviation or symbol in the circle
    territories.append('text')
      .attr('x', centroid[0])
      .attr('y', centroid[1])
      .attr('font-family', 'serif')
      .attr('font-size', '10px')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', '#5D4037')
      .text(empire.token_symbol?.substring(0, 1) || '?');
    
    // Find optimal position and size for the label
    const { x: labelX, y: labelY, maxWidth } = findOptimalLabelPosition(
      cellPolygon,
      centroid,
      width,
      height
    );
    
    // Get truncated name that fits within maxWidth
    const empireName = empire.token_name || 'Unknown Empire';
    const displayName = getTruncatedName(empireName, maxWidth);
    
    // Calculate final label width based on displayName length
    const labelWidth = Math.min(displayName.length * 7, maxWidth);
    const labelHeight = 24;

    // Create an RPG-style scroll/banner for the label - simplified for better fit
    const bannerPath = `
      M${labelX - labelWidth/2},${labelY - labelHeight/2 + 3}
      Q${labelX - labelWidth/2 + 3},${labelY - labelHeight/2} ${labelX - labelWidth/2 + 5},${labelY - labelHeight/2}
      H${labelX + labelWidth/2 - 5}
      Q${labelX + labelWidth/2 - 3},${labelY - labelHeight/2} ${labelX + labelWidth/2},${labelY - labelHeight/2 + 3}
      V${labelY + labelHeight/2 - 3}
      Q${labelX + labelWidth/2 - 3},${labelY + labelHeight/2} ${labelX + labelWidth/2 - 5},${labelY + labelHeight/2}
      H${labelX - labelWidth/2 + 5}
      Q${labelX - labelWidth/2 + 3},${labelY + labelHeight/2} ${labelX - labelWidth/2},${labelY + labelHeight/2 - 3}
      Z
    `;

    // Add banner background with RPG style
    labels.append('path')
      .attr('d', bannerPath)
      .attr('fill', '#f9f3e2')
      .attr('stroke', '#5D4037')
      .attr('stroke-width', 1.5)
      .attr('class', 'territory-label-bg')
      .attr('data-index', index)
      .on('mouseenter', () => handleRegionHover(empire, index))
      .on('mouseleave', handleTerritoryLeave);

    // Add a subtle shadow for depth
    labels.append('path')
      .attr('d', bannerPath)
      .attr('transform', 'translate(1, 1)')
      .attr('fill', 'rgba(0,0,0,0.15)')
      .attr('stroke', 'none')
      .attr('class', 'territory-label-shadow');

    // Text label with better visibility
    labels.append('text')
      .attr('x', labelX)
      .attr('y', labelY)
      .attr('font-family', 'serif')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', '#5D4037')
      .attr('class', 'territory-label')
      .attr('data-index', index)
      .text(displayName)
      .on('mouseenter', () => handleRegionHover(empire, index))
      .on('mouseleave', handleTerritoryLeave);
  }
};

// Function to create a temporary visualization if the full map generation fails
const createTemporaryVisualization = (svg: d3.Selection<SVGElement, unknown, null, undefined>, width: number, height: number) => {
  // Clear svg
  svg.selectAll('*').remove();
  
  // Create basic circle representations for empires
  const radius = Math.min(width, height) * 0.03;
  const circleGroup = svg.append('g')
    .attr('class', 'empire-circles');
    
  // Add parchment background
  svg.append('rect')
    .attr('width', width)
    .attr('height', height)
    .attr('fill', '#f9f3e2')
    .attr('stroke', '#8B6B4C')
    .attr('stroke-width', 5);
    
  // Add a title
  svg.append('text')
    .attr('x', width / 2)
    .attr('y', 40)
    .attr('text-anchor', 'middle')
    .attr('font-family', 'serif')
    .attr('font-size', '24px')
    .attr('fill', '#5D4037')
    .text('Empire Territories');
    
  // Position circles in a circle layout
  for (const [index, empire] of empires.value.entries()) {
    const angle = (index / empires.value.length) * 2 * Math.PI;
    const cx = width / 2 + Math.cos(angle) * (width * 0.3);
    const cy = height / 2 + Math.sin(angle) * (height * 0.3);
    
    // Create circle for empire
    circleGroup.append('circle')
      .datum(empire)
      .attr('cx', cx)
      .attr('cy', cy)
      .attr('r', radius)
      .attr('fill', '#D5BF86')
      .attr('stroke', '#5D4037')
      .attr('stroke-width', 2)
      .attr('data-index', index)
      .on('mouseenter', () => handleRegionHover(empire, index))
      .on('mouseleave', handleTerritoryLeave);
      
    // Add empire name with better visibility
    const empireName = empire.token_name || 'Unknown Empire';
    const displayName = empireName.length > 15 ? `${empireName.substring(0, 13)}...` : empireName;
    
    // Text background
    circleGroup.append('rect')
      .attr('x', cx - (displayName.length * 3))
      .attr('y', cy + radius + 5)
      .attr('width', displayName.length * 6)
      .attr('height', 18)
      .attr('rx', 3)
      .attr('ry', 3)
      .attr('fill', '#f9f3e2')
      .attr('stroke', '#5D4037')
      .attr('stroke-width', 1)
      .attr('opacity', 0.9);
      
    // Text label
    circleGroup.append('text')
      .attr('x', cx)
      .attr('y', cy + radius + 15)
      .attr('text-anchor', 'middle')
      .attr('font-family', 'serif')
      .attr('font-size', '12px')
      .attr('fill', '#5D4037')
      .text(displayName);
  }
  
  // Connect to center with lines
  circleGroup.append('line')
    .attr('x1', width / 2)
    .attr('y1', height / 2)
    .attr('x2', width / 2)
    .attr('y2', height / 2)
    .attr('stroke', '#8B6B4C')
    .attr('stroke-width', 1)
    .attr('stroke-dasharray', '3,2');
  
  // Add center point
  circleGroup.append('circle')
    .attr('cx', width / 2)
    .attr('cy', height / 2)
    .attr('r', radius * 1.2)
    .attr('fill', '#C09A64')
    .attr('stroke', '#5D4037')
    .attr('stroke-width', 2);
    
  mapGenerated.value = true;
};

// Calculate centroid of a polygon
const calculateCentroid = (points: Array<[number, number]>): [number, number] => {
  if (!points.length) return [0, 0];
  
  let sumX = 0;
  let sumY = 0;
  
  for (const point of points) {
    sumX += point[0];
    sumY += point[1];
  }
  
  return [sumX / points.length, sumY / points.length];
};

// Set up theme observer for dark/light mode changes
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (
      mutation.attributeName === 'data-theme' &&
      svgRef.value &&
      mapContainer.value
    ) {
      // Redraw map when theme changes
      initializeMap();
    }
  }
});

// Initial setup and data loading
onMounted(() => {
  // Fetch empire data
  fetchEmpires();
  
  // Set up resize listener
  window.addEventListener('resize', handleResize);
  
  // Initialize view box
  updateViewBox();
  
  // Set up theme observer for dark/light mode changes
  const html = document.documentElement;
  observer.observe(html, { attributes: true });
  
  // Store observer for cleanup
  themeObserver.value = observer;
});

// Clean up event listeners
onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
  
  // Disconnect theme observer
  if (themeObserver.value) {
    themeObserver.value.disconnect();
  }
});
</script>

<style>
  .empire-map-container {
    max-width: 1200px;
    margin: 0 auto;
  }

  .territory-path {
    transition: opacity 0.3s ease, stroke-width 0.3s ease;
  }

  .territory-path:hover {
    opacity: 0.9;
    stroke-width: 3px;
  }
  
  .territory-label-bg, .territory-label {
    cursor: pointer;
    transition: filter 0.3s ease;
  }
  
  .territory-label-bg:hover, .territory-label:hover {
    filter: brightness(1.05);
  }

  .empire-info {
    z-index: 10;
    transition: all 0.3s ease;
  }

  .map-background {
    transition: fill 0.3s ease;
  }

  /* Mobile optimization */
  @media (max-width: 768px) {
    .empire-legend {
      width: 100%;
    }
    
    .empire-legend .grid {
      grid-template-columns: 1fr 1fr;
    }
    
    .hover-info {
      max-width: 250px !important;
    }
  }
</style>
