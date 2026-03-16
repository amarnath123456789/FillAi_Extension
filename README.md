<div align="center">
  <h1>FillAI Extension</h1>
  <p>An AI-powered browser extension leveraging Google Gemini to intelligently evaluate and fill content.</p>
</div>

## 🌟 Overview

FillAI is a modern browser extension built with React, TypeScript, and Vite. It integrates seamlessly with the Google Gemini API to analyze page content and assist users through intelligent heuristics and LLM-driven actions.

## 🚀 Features

- **AI-Powered Assistance:** Utilizes the Google GenAI SDK for advanced content generation and analysis directly in the browser.
- **Modern UI/UX:** Built with React 19 and Framer Motion for smooth, interactive popup and option views.
- **Modular Architecture:** Clean separation of background scripts, content scripts, popup, and options pages.
- **Fast Development:** Scaffolded with Vite for lightning-fast HMR and optimized builds.

## 🛠️ Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- A [Google Gemini API Key](https://aistudio.google.com/app/apikey)

## 🏃‍♂️ Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment Setup:**
   Create a `.env.local` file in the root directory and add your Gemini API key:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

3. **Start Development Server (UI Preview):**
   To run the standalone web view for testing UI components independently:
   ```bash
   npm run dev
   ```

## 📦 Building and Loading the Extension

1. **Build the extension files:**
   ```bash
   npm run build:ext
   ```
   This will compile the background scripts, content scripts, and UI assets into the `dist-ext` directory.

2. **Load into Chrome or Edge:**
   - Open your browser and navigate to the Extensions page (`chrome://extensions/` or `edge://extensions/`).
   - Enable **Developer mode** (toggle in the top right).
   - Click **Load unpacked**.
   - Select the `dist-ext` folder generated in the previous step.

## 💻 Technologies Used

- **Framework:** React 19
- **Build Tool:** Vite
- **Language:** TypeScript
- **AI Integration:** `@google/genai`
- **Styling/Animation:** Motion

