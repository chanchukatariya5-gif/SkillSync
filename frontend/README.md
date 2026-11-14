# SkillSync web client

The React/Vite single-page application provides account access, resume analysis, job matching, skill-gap analysis, learning progress, and application tracking.

## Development

From this directory:

```sh
npm install
npm run dev
npm run lint
npm run build
```

The Vite development server proxies `/api` requests to `http://localhost:5000`. Set `API_PROXY_TARGET` when the API runs on a different address. See the [project setup guide](../README.md) for running the API and resume service.

The app stores its bearer token in browser local storage. Do not use real resume data on an untrusted or shared device.
