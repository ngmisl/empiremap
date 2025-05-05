# Empire Maps

[![CodeQL](https://github.com/ngmisl/empiremap/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/ngmisl/empiremap/actions/workflows/github-code-scanning/codeql)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## Overview

Empire Maps is a medieval-themed visualization component that displays empire territories on an interactive map. It uses Voronoi regions to represent different empire territories, with territory sizes scaled based on economic values. The component features authentic medieval styling with parchment textures, hand-drawn borders, and an antique appearance.

## Features

- **Medieval Map Visualization**: Authentic parchment-style maps with hand-drawn territory borders
- **Economic Territory Scaling**: Empire territory sizes proportional to their economic values
- **Top 10 Empires**: Automatically fetches and displays the top 10 empires by economic value
- **Interactive Elements**: Hover over territories to see detailed empire information 
- **Legend Display**: Empire legend displayed vertically alongside the map
- **Responsive Design**: Adapts to different screen sizes while maintaining medieval aesthetics
- **Dark Mode Support**: Automatically adapts to system dark/light mode preferences

## Technologies Used

- **Vue 3**: Framework for building the user interface
- **TypeScript**: Type-safe JavaScript
- **Vite**: Build tool for fast development
- **D3.js**: Data visualization library for map generation
- **d3-delaunay**: Library for generating Voronoi diagrams
- **Zod**: Runtime validation of API responses
- **Tailwind CSS**: Utility-first CSS framework
- **DaisyUI**: Component library for Tailwind CSS
- **Bun**: JavaScript runtime & package manager

## Getting Started

### Prerequisites

- Bun (for package management)
- Modern web browser

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/empiremaps.git
   cd empiremaps
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Start the development server:
   ```bash
   bun run dev
   ```

4. Open your browser and navigate to `http://localhost:5173`

## Usage

The `EmpireMap` component can be used in any Vue application:

```vue
<template>
  <EmpireMap />
</template>

<script setup>
import EmpireMap from './components/EmpireMap.vue';
</script>
```

## API Integration

The component fetches data from the Empire Builder API. It retrieves the top 10 empires based on economic value and visualizes them on the map. Each empire entry contains:

- Token name
- Token symbol
- Base token (contract address)
- Economic data (distributed value, burned value)

## Styling and Customization

The map features an authentic medieval styling with:

- Parchment-textured territories
- Hand-drawn borders
- Medieval compass rose
- Scroll-style labels
- Earthy color palette

## License

This project is licensed under the MIT License - see the LICENSE file for details.
