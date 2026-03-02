
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Svelte-based skin editor for the Osirus synthesizer, designed to render and interact with synthesizer skin definitions loaded from JSON configuration files. The application displays synthesizer interfaces with tabs, controls, and visual elements based on JSON skin definitions.

## Development Commands

- `npm run dev` - Start development server with Vite
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run format` - Format source code with Prettier
- `npm run sort` - Sort package.json keys

## Architecture

### Core Components

**App.svelte** - Main application component that:
- Manages skin selection and loading from remote URLs
- Handles tab navigation for different synthesizer pages
- Loads skin definitions from the gearmulator repository
- Renders the sidebar with available skins and main canvas area

**CanvasRenderer.svelte** - Canvas-based rendering engine that:
- Loads and caches images from remote skin assets
- Renders synthesizer UI elements (buttons, rotaries, labels, etc.)
- Handles canvas interactions and tab switching
- Processes skin JSON definitions to draw visual components

**store.js** - Svelte store for global state management (currently minimal)

### Data Flow

1. Skin definitions are loaded from `https://raw.githubusercontent.com/dsp56300/gearmulator/main/source/osirusJucePlugin/skins/`
2. JSON5 is used to parse skin configuration files that define UI layout
3. Images are dynamically loaded from the same remote repository
4. Canvas rendering processes the skin hierarchy to display visual elements

### Skin Definition Structure

Skin JSON files contain:
- `root` - Canvas dimensions and scale
- `tabgroup` - Tab navigation configuration with pages and buttons
- `children` - Hierarchical UI elements (buttons, labels, rotaries, containers)
- Element types: `image`, `button`, `rotary`, `label`, `combobox`, `container`

### Key Technologies

- **Svelte 4** with Vite build system
- **TailwindCSS** for styling
- **JSON5** for parsing skin definitions with comments
- **Canvas API** for synthesizer UI rendering
- **Lucide Svelte** for icons

The application fetches skins from a remote GitHub repository and renders them as interactive synthesizer interfaces using HTML5 Canvas.