import { contextBridge, ipcRenderer } from "electron";
import type { AppState, BrowserAction, BrowserPolicy, PlanStep, ScreenSource, StartTaskInput } from "../shared/types";

const api = {
  getState: (): Promise<AppState> => ipcRenderer.invoke("app:get-state"),
  onState: (callback: (state: AppState) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: AppState) => callback(state);
    ipcRenderer.on("app:state", listener);
    return () => {
      ipcRenderer.removeListener("app:state", listener);
    };
  },
  checkAuth: (): Promise<string> => ipcRenderer.invoke("auth:check"),
  openCodexLogin: (): Promise<void> => ipcRenderer.invoke("auth:login"),
  listScreenSources: (): Promise<ScreenSource[]> => ipcRenderer.invoke("screen:list-sources"),
  startScreenShare: (sourceId?: string): Promise<void> => ipcRenderer.invoke("screen:start", sourceId),
  stopScreenShare: (): Promise<void> => ipcRenderer.invoke("screen:stop"),
  pinScreenSource: (sourceId: string): Promise<void> => ipcRenderer.invoke("screen:pin", sourceId),
  unpinScreenSource: (sourceId: string): Promise<void> => ipcRenderer.invoke("screen:unpin", sourceId),
  focusScreenSource: (sourceId: string): Promise<void> => ipcRenderer.invoke("screen:focus", sourceId),
  observePinnedSources: (): Promise<void> => ipcRenderer.invoke("screen:observe-pinned"),
  resolveMousePlan: (allowed: boolean): Promise<void> => ipcRenderer.invoke("mouse-plan:resolve", allowed),
  startTask: (input: StartTaskInput): Promise<void> => ipcRenderer.invoke("task:start", input),
  sendCommand: (prompt: string): Promise<void> => ipcRenderer.invoke("task:send-command", prompt),
  observeCurrent: (): Promise<void> => ipcRenderer.invoke("task:observe-current"),
  pauseTask: (): Promise<void> => ipcRenderer.invoke("task:pause"),
  resumeTask: (): Promise<void> => ipcRenderer.invoke("task:resume"),
  stopTask: (): Promise<void> => ipcRenderer.invoke("task:stop"),
  updatePlanStep: (stepId: string, status: PlanStep["status"], note?: string): Promise<void> =>
    ipcRenderer.invoke("plan-step:update", { stepId, status, note }),
  resolveApproval: (
    id: string,
    allowed: boolean,
    editedAction?: BrowserAction
  ): Promise<void> => ipcRenderer.invoke("approval:resolve", { id, allowed, editedAction }),
  defaultPolicy: (): Promise<BrowserPolicy> => ipcRenderer.invoke("policy:default"),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke("external:open", url)
};

contextBridge.exposeInMainWorld("browserPilot", api);

export type BrowserPilotApi = typeof api;
