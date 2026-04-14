import backendConfig from "../backend.config.json";

/** Base URL for the Presto backend (see `frontend/backend.config.json`). */
export const API_BASE_URL = `http://127.0.0.1:${String(backendConfig.BACKEND_PORT)}`;
