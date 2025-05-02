<script setup lang="ts">
import EmpireMap from './components/EmpireMap.vue'
</script>

<template>
  <div class="min-h-screen bg-base-100 text-base-content flex flex-col items-center">
    <header class="w-full p-4 bg-base-200 flex justify-between items-center">
      <h1 class="text-3xl font-bold">Empire Maps</h1>
      
      <!-- Dark mode toggle -->
      <label class="swap swap-rotate">
        <input type="checkbox" @change="toggleTheme" :checked="isDarkMode" />
        <div class="swap-on">🌙</div>
        <div class="swap-off">🔆</div>
      </label>
    </header>
    
    <main class="container mx-auto p-4 flex-grow">
      <EmpireMap />
    </main>
    
    <footer class="p-4 bg-base-300 text-center text-sm w-full">
      <p class="opacity-80">
        Made with love by 
        <a href="https://warpcast.com/metaend.eth" target="_blank" rel="noopener noreferrer" 
           class="font-medium hover:underline hover:text-primary transition-colors">
          metaend
        </a> 
        and 
        <a href="https://mtdv.orbiter.website" target="_blank" rel="noopener noreferrer"
           class="font-medium hover:underline hover:text-primary transition-colors">
          $MTDV Empire
        </a>
      </p>
    </footer>
  </div>
</template>

<script lang="ts">
export default {
  data() {
    return {
      isDarkMode: window.matchMedia('(prefers-color-scheme: dark)').matches
    }
  },
  mounted() {
    // Initialize theme based on user preference or system setting
    this.applyTheme();
    
    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      this.isDarkMode = e.matches;
      this.applyTheme();
    });
  },
  methods: {
    toggleTheme() {
      this.isDarkMode = !this.isDarkMode;
      this.applyTheme();
    },
    applyTheme() {
      document.documentElement.setAttribute('data-theme', this.isDarkMode ? 'dark' : 'light');
      localStorage.setItem('theme', this.isDarkMode ? 'dark' : 'light');
    }
  }
}
</script>

<style>
/* Global styles */
:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;
}

/* For mobile optimization */
@media (max-width: 768px) {
  html {
    font-size: 14px;
  }
}
</style>
