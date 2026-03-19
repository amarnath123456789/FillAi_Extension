<div align="center">
  <h1>FillAI Extension</h1>
   <p>An AI-powered browser extension leveraging local WebLLM to intelligently evaluate and fill content.</p>
</div>

## 🌟 Overview

FillAI is a modern browser extension built with React, TypeScript, and Vite. It integrates with local WebLLM inference in-browser to analyze page content and assist users through intelligent heuristics and LLM-driven actions.

## 🚀 Features

- **AI-Powered Assistance:** Utilizes local WebLLM runtime for advanced content generation and analysis directly in the browser.
- **Modern UI/UX:** Built with React 19 and Framer Motion for smooth, interactive popup and option views.
- **Modular Architecture:** Clean separation of background scripts, content scripts, popup, and options pages.
- **Fast Development:** Scaffolded with Vite for lightning-fast HMR and optimized builds.

## 🛠️ Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- A Chromium browser with WebGPU support enabled

## 🏃‍♂️ Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment Setup:**
   Create a `.env.local` file in the root directory and choose the local WebLLM model:
   ```env
   VITE_WEBLLM_MODEL=Llama-3.2-1B-Instruct-q4f16_1-MLC
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

## 🧭 Form Detection (Smart Autofill Guard)

The content script now checks whether the current page is a meaningful form page before showing/running page-level autofill.

- **Detector module:** `src/utils/formDetector.ts`
- **Entry point integration:** `src/content/index.ts`

### Heuristic signals

- Counts visible, enabled fields from:
  - `input[type="text"]`
  - `input[type="email"]`
  - `input[type="tel"]`
  - `input[type="number"]`
  - `textarea`
  - `select`
- Hidden and disabled fields are ignored.
- Page text scan checks first ~2000 chars for form-intent keywords.
- Scoring:
  - `+2` if fields `>= 3`
  - `+2` if `<form>` exists and fields `>= 2`
  - `+1` if keyword match and fields `>= 2`
  - returns `true` when score `>= 3`
- Hard exclusion: if total eligible fields `<= 1`, returns `false`.

### Dynamic form handling

- Trigger mounting is re-checked shortly after load and on DOM mutations.
- This supports delayed/SPA-rendered forms without polling loops.

### Debug logging (optional)

Enable in page DevTools console:

```js
localStorage.setItem('fillai:formDetectorDebug', '1')
```

Disable:

```js
localStorage.removeItem('fillai:formDetectorDebug')
```

When enabled, detector logs include:

- `totalFields`
- `hasForm`
- `keywordMatch`
- `score`

### Manual test checklist

1. Build and load extension:
   - `npm run build:ext`
   - Reload unpacked extension from `dist-ext`.
2. Open each page type and verify behavior:
   - Login/Register page → Autofill trigger appears.
   - Job application/Contact page → Autofill trigger appears.
   - Search homepage (single search box) → trigger does **not** appear.
   - Blog/article page (no meaningful fields) → trigger does **not** appear.
   - Chat UI with single message box → trigger does **not** appear.
3. For delayed forms (SPA/modal):
   - Navigate/open form after initial page load.
   - Confirm trigger appears once fields are rendered.
4. With debug enabled, verify logs match expectations for `totalFields` and `score`.

## ⚡ Smart Cache (LLM Responses)

FillAI uses a lightweight cache in `chrome.storage.local` (`fillai_cache`) for successful LLM outputs only.

- **Module:** `src/utils/cache.ts`
- **Integration:** `src/services/fieldProcessor.ts` (LLM path only)

### Cache key strategy

- **Simple fields** (`full_name`, `first_name`, `last_name`, `email`, `phone`, `linkedin`):
   - key uses `fieldType + profile.fullName`
- **Context fields** (essay/complex and everything else):
   - key uses `fieldType + hostname + normalizedTitle + label`
   - title normalization lowercases, removes `- | –` noise, collapses spaces, and truncates to 80 chars

### Expiry and limits

- TTL: `24h` (`24 * 60 * 60 * 1000`)
- Expired entries are deleted on read
- Max size: `100` entries
- Oldest entries are evicted when limit is exceeded

### Cache guardrails

Cache writes happen only when all are true:

- source is LLM
- value is non-empty
- value length is `>= 20`
- classifier confidence is `>= 0.6`

Heuristic outputs are never cached.

### Cache debug signals

On read:

- `console.log('[Cache] HIT:', key)`
- `console.log('[Cache] MISS:', key)`

## 💻 Technologies Used

- **Framework:** React 19
- **Build Tool:** Vite
- **Language:** TypeScript
- **AI Integration:** `@mlc-ai/web-llm`
- **Styling/Animation:** Motion

