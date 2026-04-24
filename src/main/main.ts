import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "node:path";
import type { BrowserAction, BrowserPolicy, StartTaskInput } from "../shared/types";
import { DEFAULT_POLICY } from "./services/browserPolicy";
import { TaskSessionManager } from "./services/taskSessionManager";

let mainWindow: BrowserWindow | undefined;
let manager: TaskSessionManager | undefined;

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

function createManager(): TaskSessionManager {
  if (!manager) {
    manager = new TaskSessionManager({
      appRoot: app.getAppPath(),
      userDataPath: app.getPath("userData"),
      cwd: app.getAppPath()
    });
    manager.on("state", (state) => {
      BrowserWindow.getAllWindows().forEach((window) => {
        window.webContents.send("app:state", state);
      });
    });
  }
  return manager;
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1100,
    minHeight: 720,
    title: "CodexOnComputer",
    backgroundColor: "#f6f4ef",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    await mainWindow.loadFile(path.join(app.getAppPath(), "dist", "renderer", "index.html"));
  }
}

app.whenReady().then(async () => {
  createManager();
  registerIpc();
  await createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", async (event) => {
  if (!manager) {
    return;
  }
  event.preventDefault();
  await manager.stopTask().catch(() => undefined);
  manager = undefined;
  app.exit(0);
});

app.on("activate", async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createWindow();
  }
});

function registerIpc(): void {
  ipcMain.handle("app:get-state", () => createManager().getState());
  ipcMain.handle("auth:check", () => createManager().checkAuth());
  ipcMain.handle("auth:login", () => createManager().openCodexLogin());
  ipcMain.handle("screen:list-sources", () => createManager().listScreenSources());
  ipcMain.handle("screen:start", (_event, sourceId?: string) => createManager().startScreenShare(sourceId));
  ipcMain.handle("screen:stop", () => createManager().stopScreenShare());
  ipcMain.handle("screen:pin", (_event, sourceId: string) => createManager().pinScreenSource(sourceId));
  ipcMain.handle("screen:unpin", (_event, sourceId: string) => createManager().unpinScreenSource(sourceId));
  ipcMain.handle("screen:focus", (_event, sourceId: string) => createManager().focusScreenSource(sourceId));
  ipcMain.handle("screen:observe-pinned", () => createManager().observePinnedSources());
  ipcMain.handle("mouse-plan:resolve", (_event, allowed: boolean) => createManager().resolveMousePlan(allowed));
  ipcMain.handle("task:start", (_event, input: StartTaskInput) => createManager().startTask(input));
  ipcMain.handle("task:pause", () => createManager().pauseTask());
  ipcMain.handle("task:resume", () => createManager().resumeTask());
  ipcMain.handle("task:stop", () => createManager().stopTask());
  ipcMain.handle(
    "approval:resolve",
    (_event, payload: { id: string; allowed: boolean; editedAction?: BrowserAction }) =>
      createManager().resolveApproval(payload.id, payload.allowed, payload.editedAction)
  );
  ipcMain.handle("policy:default", (): BrowserPolicy => DEFAULT_POLICY);
  ipcMain.handle("external:open", (_event, url: string) => shell.openExternal(url));
}
