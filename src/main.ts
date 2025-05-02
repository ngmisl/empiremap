import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

// Load theme from local storage or use system preference
const theme = localStorage.getItem('theme') || 
              (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
document.documentElement.setAttribute('data-theme', theme);

createApp(App).mount('#app')
