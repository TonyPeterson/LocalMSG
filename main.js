const { app, BrowserWindow } = require('electron');

app.disableHardwareAcceleration();

function createWindow () {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true, // This lets your front-end talk to your Node backend later
      contextIsolation: false
    }
  });

  // Load the HTML file we are about to make
  win.loadFile('index.html');
  
  // Optional: Open the Chrome DevTools automatically so you can inspect elements
  // win.webContents.openDevTools(); 
}

// When Electron is ready, draw the window
app.whenReady().then(createWindow);

// When all windows are closed, kill the app entirely
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});