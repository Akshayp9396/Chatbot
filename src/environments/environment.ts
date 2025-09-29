// src/environments/environment.ts
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:8080/api', // <-- your backend host:port (and optional /api)
  publicClientKey: '',                      // optional, NON-secret
  backendApiKey: ''                         // optional, only if your backend insists
} 