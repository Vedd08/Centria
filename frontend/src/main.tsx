import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { MobileUploadPage } from './components/PatientHistory/MobileUploadPage';
import './index.css';

// A phone that scanned a document-upload QR code opens "/?upload=<token>". That page
// stands alone — no sign-in, no app shell. A query string (not a path) keeps it on
// the root URL, which the host always serves.
const uploadToken = new URLSearchParams(window.location.search).get('upload');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{uploadToken ? <MobileUploadPage token={uploadToken} /> : <App />}</React.StrictMode>,
);
