import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { createRepository } from './storage';

createRepository().then(({ repository, persistent }) => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <BrowserRouter>
        <App repository={repository} persistent={persistent} />
      </BrowserRouter>
    </React.StrictMode>,
  );
});
