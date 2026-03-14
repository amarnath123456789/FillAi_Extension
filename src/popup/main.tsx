import React from 'react';
import ReactDOM from 'react-dom/client';
import { PopupPage } from '../components/PopupPage';
import { ProfileProvider } from '../store';
import '../index.css';

function openOptions() {
  if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ProfileProvider>
      <PopupPage onOptionsClick={openOptions} />
    </ProfileProvider>
  </React.StrictMode>
);
