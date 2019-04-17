// Modules to control application life and create native browser window
const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron')

// Window state manager
const windowStateManager = require('electron-window-state')

// For automatic reloads on changes MAKES SQLITE GO INSANE
// require('electron-reload')(__dirname);

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow
let miniPlayerWindow

function createWindow () {

  let windowState = windowStateManager({
    defaultWidth: 1115,
    defaultHeight: 700,
  })

  // Create loading window
  loadWindow = new BrowserWindow({
    width:  500,
    height:  300,
    resizable: false,
    frame: false,
    // alwaysOnTop: true,
    show: false,
    icon: './assets/icon_new.ico'
  })

  // load loading page
  loadWindow.loadFile('splash.html')

  loadWindow.once('ready-to-show', () => {
    loadWindow.show();
  })

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    // transparent: true,
    minHeight: 600,
    minWidth: 1090,
    frame: false,
    webPreferences: {
      nodeIntegration: true
    },
    show: false,
    icon: './assets/icon_new.ico'
  })

  mainWindow.on('ready-to-show', () => {
    // Restoring user state by triggering an event, that executes restoreUserState function in renderer process
    mainWindow.webContents.send('restore-user-state')
  })

  // show window when dom loads
  mainWindow.webContents.once('dom-ready', () => {
    loadWindow.hide();
    loadWindow.close();
    // Restoring window size and position
    windowState.manage(mainWindow);
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

  // showing/hiding miniPlayerWindow
  ipcMain.on('show-hide-mini-player', () => {
    if(miniPlayerWindow) {
      if(miniPlayerWindow.isDestroyed()) {
        createMiniPlayerWindow();
      } else {
        miniPlayerWindow.destroy();
      }
    } else {
      createMiniPlayerWindow();
    }
  })

  // Mini player events, putting them here becuase create mini player window can be called sveral time that multiplies the events
  // Sending data receieved from mainWindow to miniPlayerWindow
  ipcMain.on('update-mini-player', (event, data) => {
    if(miniPlayerWindow) {
      if(!miniPlayerWindow.isDestroyed()) {
        miniPlayerWindow.webContents.send('update-mini-player-info', data);
      }      
    }
  }) 

  // Checking if main player is playing or not
  ipcMain.on('playing-status', (event, data) => {
    if(miniPlayerWindow) {
        if(!miniPlayerWindow.isDestroyed()) { miniPlayerWindow.webContents.send('mini-playing-status', data);
      }
    }
  })

  // Sending colors to main theme you it can use them;
  ipcMain.on('mini-color-theme', (event, data) => {
    if(miniPlayerWindow) {
        if(!miniPlayerWindow.isDestroyed()) { miniPlayerWindow.webContents.send('update-mini-player-theme', data);
      }
    }
  })

  // Playing pausing from miniplayer
  ipcMain.on('mini-player-play-pause', () => {
    mainWindow.webContents.send('play-pause-track');
  })
  ipcMain.on('mini-player-next-track', () => {
    mainWindow.webContents.send('play-next-track');
  })
  ipcMain.on('mini-player-previous-track', () => {
    mainWindow.webContents.send('play-previous-track');
  })
  
}

function createMiniPlayerWindow() {
  // Mini Player
  miniPlayerWindow = new BrowserWindow({
    width: 200,
    height: 200,
    x: 1158,
    y: 518,
    resizable: true,
    frame: false,
    // transparent: true,
    webPreferences: {
      nodeIntegration: true
    },
    alwaysOnTop: true,
    show: false,
    icon: './assets/icon_new.ico'
  })

  miniPlayerWindow.loadFile('./mini-player.html');

  miniPlayerWindow.on('ready-to-show', () => {
    mainWindow.webContents.send('update-mini-player-on-spawn');
    miniPlayerWindow.show();    
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  createWindow();  
  // Global play/pause, next & previous shortcuts
  globalShortcut.register('CommandOrControl+Shift+Right', () => {
    // Playing next track
    mainWindow.webContents.send('play-next-track');
    console.log('playing next track');
  }) 
  globalShortcut.register('CommandOrControl+Shift+Left', () => {
    // Playing previous track
    mainWindow.webContents.send('play-previous-track');
    console.log('playing previous track');
  })
  globalShortcut.register('CommandOrControl+Shift+Down', () => {
    // Playing/pausing track
    mainWindow.webContents.send('play-pause-track');
    console.log('playing/pausing track');
  })
  globalShortcut.register('CommandOrControl+Shift+PageUp', () => {
    // Increasing volume
    mainWindow.webContents.send('player-volume-up');
    console.log('increasing volume');
  })
  globalShortcut.register('CommandOrControl+Shift+PageDown', () => {
    // decreasing volume
    mainWindow.webContents.send('player-volume-down');
    console.log('decreasing volume');
  })

  // Registering media keys
  globalShortcut.register('MediaNextTrack', () => {
    // Playing next track
    mainWindow.webContents.send('play-next-track');
    console.log('playing next track');
  }) 
  globalShortcut.register('MediaPreviousTrack', () => {
    // Playing previous track
    mainWindow.webContents.send('play-previous-track');
    console.log('playing previous track');
  })
  globalShortcut.register('MediaPlayPause', () => {
    // Playing/pausing track
    mainWindow.webContents.send('play-pause-track');
    console.log('playing/pausing track');
  })
  globalShortcut.register('VolumeUp', () => {
    // Increasing volume
    mainWindow.webContents.send('player-volume-up');
    console.log('increasing volume');
  })
  globalShortcut.register('VolumeDown', () => {
    // decreasing volume
    mainWindow.webContents.send('player-volume-down');
    console.log('decreasing volume');
  })
  globalShortcut.register('VolumeMute', () => {
    // decreasing volume
    mainWindow.webContents.send('player-volume-mute-unmute');
    console.log('muting/unmuting volume');
  })

})

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