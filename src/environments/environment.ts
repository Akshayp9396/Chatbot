// src/environments/environment.ts
// export const environment = {
//   production: false,
//   apiBaseUrl: 'http://100.123.49.48:8000', // <-- your backend host:port (and optional /api)
//   publicClientKey: '',                      // optional, NON-secret
//   backendApiKey: 'AJSsefdUiSKcqag7CkXjI6A1UgaOk-tahpTxZLjbNm-Pqxbta67EFnrMqkmVEnRW'                         // optional, only if your backend insists
// } 

export const environment = {
  production: false,
  // Use Angular dev proxy so the browser stays same-origin → no CORS
  apiBaseUrl: '/api',
  publicClientKey: '',
  // OK for testing; avoid real secrets in frontend for prod
  backendApiKey: 'AJSsefdUiSKcqag7CkXjI6A1UgaOk-tahpTxZLjbNm-Pqxbta67EFnrMqkmVEnRW'
};