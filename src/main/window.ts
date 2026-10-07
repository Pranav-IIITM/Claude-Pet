import { BrowserWindow, screen } from "electron";
import { join } from "node:path";

const WIDTH = 260;
const HEIGHT = 300;
const MARGIN = 24;

export function createPetWindow(): BrowserWindow {
  const { workArea } = screen.getPrimaryDisplay();

  const win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    x: workArea.x + workArea.width - WIDTH - MARGIN,
    y: workArea.y + workArea.height - HEIGHT - MARGIN,
    transparent: true,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  // Start fully click-through; main's hover poll re-enables the mouse over the pet.
  win.setIgnoreMouseEvents(true);

  void win.loadFile(join(__dirname, "../renderer/index.html"));
  return win;
}
