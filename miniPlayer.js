const { remote, ipcRenderer } = require('electron');

let win = remote.getCurrentWindow();
const closeMiniPlayerBtn = document.querySelector('#closeMiniPlayerBtn');
closeMiniPlayerBtn.addEventListener('click', () => {
    win.destroy();
})

ipcRenderer.on('update-mini-player-info', (event, trackInfo) => {
    console.log(trackInfo);
    document.querySelector('#mini-artwork').style = `background: url('${trackInfo.artwork}')`;
})

let musicPlaying = false;

const miniBackBtn = document.querySelector('#miniPlayerBackBtn');
const miniPlayBtn = document.querySelector('#miniPlayerPlayBtn');
const miniForwardBtn = document.querySelector('#miniPlayerForwardBtn');

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