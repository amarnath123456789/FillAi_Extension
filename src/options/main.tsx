import React from 'react';
import ReactDOM from 'react-dom/client';
import { OptionsPage } from '../components/OptionsPage';
import { ProfileProvider } from '../store';
import '../index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ProfileProvider>
      <OptionsPage />
    </ProfileProvider>
  </React.StrictMode>
);
