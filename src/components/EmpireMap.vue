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
        <div class="map-visualization-container relative min-h-[500px] border border-base-300 rounded-lg p-4" ref="mapContainer">
          <!-- SVG Map Container -->
          <div class="flex flex-wrap gap-4 justify-center items-center h-full" v-if="empires.length > 0">
            <div v-for="(empire, index) in empires.slice(0, 8)" :key="empire.base_token"
                 class="territory-box w-32 h-32 flex flex-col items-center justify-center rounded-lg p-3 cursor-pointer transition-all duration-200"
                 :style="{ backgroundColor: getColor(index), border: '2px solid white' }"
                 @mouseenter="handleEmpireHover(empire)" 
                 @mouseleave="handleTerritoryLeave">
              <div class="text-center">
                <div class="text-lg font-bold text-white mb-1">{{ empire.token_symbol }}</div>
                <div class="text-xs text-white/80 truncate w-full">{{ empire.token_name }}</div>
                <div class="mt-2 badge badge-sm badge-outline text-xs">${{ formatNumber(empire.total_distributed) }}</div>
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
                   @mouseenter="handleEmpireHover(empire)"
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
                <div class="text-opacity-70 text-sm">Treasury:</div>
                <div class="font-semibold">${{ formatNumber(hoveredEmpire.total_distributed) }}</div>
                
                <div class="text-opacity-70 text-sm">Burned:</div>
                <div class="font-medium">{{ formatNumber(hoveredEmpire.total_burned) }}</div>
                
                <div class="text-opacity-70 text-sm">Token:</div>
                <div class="font-medium text-xs truncate" :title="hoveredEmpire.base_token">
                  {{ formatShortAddress(hoveredEmpire.base_token) }}
                </div>
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
const mapContainer = ref<HTMLElement | null>(null); 
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
const formatShortAddress = (address: string): string => {
  if (!address || address.length < 10) return address;
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

// Handle territory hover
const handleEmpireHover = (empire: Empire) => {
  hoveredEmpire.value = empire;
  hoveredTerritory.value = {
    id: 0,
    name: `${empire.token_name} Territory`,
    path: '',
    color: getColor(empires.value.indexOf(empire)),
    neighbors: [],
    empire
  };
};

// Handle mouse leaving territories
const handleTerritoryLeave = () => {
  hoveredTerritory.value = null;
  hoveredEmpire.value = null;
};

// Get a color from d3 color scheme for an empire
const getColor = (index: number): string => {
  return d3.schemeCategory10[index % 10];
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
    mapInitialized.value = true;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error occurred';
    console.error('Error fetching empire data:', err);
  } finally {
    loading.value = false;
  }
};

// Handle window resize for responsive map
const handleResize = () => {
  // Responsive handling without D3 map redrawing
};

// Initialize on component mount
onMounted(() => {
  fetchEmpires();
  
  // Add resize event listener for responsiveness
  window.addEventListener('resize', handleResize);
  
  // Initialize theme watcher to handle dark/light mode changes
  const observer = new MutationObserver(() => {
    // Update theme state if needed
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
