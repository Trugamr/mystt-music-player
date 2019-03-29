// Modules to control application life and create native browser window
const {app, BrowserWindow, ipcMain} = require('electron')

// For automatic reloads on changes MAKES SQLITE GO INSANE
// require('electron-reload')(__dirname);

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow

function createWindow () {
  // Create loading window
  loadWindow = new BrowserWindow({
    width:  500,
    height:  300,
    resizable: false,
    frame: false,
    alwaysOnTop: true,
    show: false
  })

  // load loading page
  loadWindow.loadFile('splash.html')

  loadWindow.once('ready-to-show', () => {
    loadWindow.show();
  })

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1115,
    height: 700,
    // transparent: true,
    minHeight: 600,
    minWidth: 1090,
    frame: false,
    webPreferences: {
      nodeIntegration: true
    },
    show: false
  })

  mainWindow.on('ready-to-show', () => {
    // Restoring user state by triggering an event, that executes restoreUserState function in renderer process
    mainWindow.webContents.send('restore-user-state')
  })

  // show window when dom loads
  mainWindow.webContents.once('dom-ready', () => {
    loadWindow.hide();
    loadWindow.close();
    mainWindow.show();  
  });

  // and load the index.html of the app.
  mainWindow.loadFile('index.html')

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()

  mainWindow.on('close', (e) => {
    // sending message to save user state
    mainWindow.webContents.send('save-user-state');

    // stopping window from closing
    e.preventDefault();

    // closing app after save state was successfull
    ipcMain.on('save-state-success', () => {
      app.exit();
    })
  })

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', function () {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.