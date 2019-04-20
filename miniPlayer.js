const { remote, ipcRenderer } = require('electron');

let win = remote.getCurrentWindow();
const closeMiniPlayerBtn = document.querySelector('#closeMiniPlayerBtn');
closeMiniPlayerBtn.addEventListener('click', () => {
    win.destroy();
})

// toggling if window always on top or not
const alwaysOnTopBtn = document.querySelector('#alwaysOnTopBtn');
alwaysOnTopBtn.addEventListener('click', () => {
    if(win.isAlwaysOnTop()) {
        win.setAlwaysOnTop(false);
        alwaysOnTopBtn.classList.remove('fa-eye-slash');
        alwaysOnTopBtn.classList.add('fa-eye');
    } else {
        win.setAlwaysOnTop(true);
        alwaysOnTopBtn.classList.remove('fa-eye');
        alwaysOnTopBtn.classList.add('fa-eye-slash');        
    }
})

ipcRenderer.on('update-mini-player-info', (event, trackInfo) => {
    console.log(trackInfo);
    document.querySelector('#mini-artwork').style = `background: url('${trackInfo.artwork}')`;
})

let musicPlaying = false;

const miniBackBtn = document.querySelector('#miniPlayerBackBtn');
const miniPlayBtn = document.querySelector('#miniPlayerPlayBtn');
const miniForwardBtn = document.querySelector('#miniPlayerForwardBtn');

const miniOverlay = document.querySelector('#mini-overlay');
ipcRenderer.on('update-mini-player-theme', (event, theme) => {
    closeMiniPlayerBtn.style = `color: ${theme.fifth}`;
    alwaysOnTopBtn.style = `color: ${theme.fifth}`;
    miniBackBtn.style = `color: ${theme.fifth}`;
    miniPlayBtn.style = `color: ${theme.fifth}`;
    miniForwardBtn.style = `color: ${theme.fifth}`;
    let color = hexToRgb(theme.first);
    document.documentElement.style.setProperty('--overlay-color', `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);
    document.documentElement.style.setProperty('--overlay-color-hover', `rgba(${color.r}, ${color.g}, ${color.b}, 0.75)`);
    document.querySelector('#mini-overlay').style = `border-color: ${theme.fifth};`;    
})



ipcRenderer.on('mini-playing-status', (event, isPlaying) => {
    musicPlaying = isPlaying;
    if(musicPlaying) {
        miniPlayBtn.classList.remove('fa-play');
        miniPlayBtn.classList.add('fa-pause');
    } else {
        miniPlayBtn.classList.remove('fa-pause');
        miniPlayBtn.classList.add('fa-play');
    }
})

miniBackBtn.addEventListener('click', (event) => {
    ipcRenderer.send('mini-player-previous-track');
})

miniPlayBtn.addEventListener('click', (event) => {
    ipcRenderer.send('mini-player-play-pause');
    if(musicPlaying) {
        miniPlayBtn.classList.remove('fa-play');
        miniPlayBtn.classList.add('fa-pause');
    } else {
        miniPlayBtn.classList.remove('fa-pause');
        miniPlayBtn.classList.add('fa-play');
    }
})

miniForwardBtn.addEventListener('click', (event) => {
    ipcRenderer.send('mini-player-next-track');
})

function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}