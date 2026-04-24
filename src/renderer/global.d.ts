import type { BrowserPilotApi } from "../main/preload";

declare global {
  interface Window {
    browserPilot: BrowserPilotApi;
  }
}

export {};
