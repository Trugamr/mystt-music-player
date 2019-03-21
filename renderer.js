// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.
// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

const { dialog } = require('electron').remote
const { remote } = require('electron')
const recursiveRead = require('recursive-readdir') 
const path = require('path')
const mm = require('music-metadata')
const fs = require('fs')
const sqlite3 = require('sqlite3')
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

// Siderbar links declaration
const sbDiscoverLink = document.querySelector('#homePage');
const sbSongsLink = document.querySelector('#songsPage');
const sbAlbumsLink = document.querySelector('#albumsPage');
const sbArtistsLink = document.querySelector('#artistsPage');
const sbLikedLink = document.querySelector('#likedPage');

let sbLinks = [sbDiscoverLink, sbSongsLink, sbAlbumsLink, sbArtistsLink, sbLikedLink];

// Get current window and creating custom min, max, close buttons
let win = remote.getCurrentWindow();
document.querySelector('#minimize-btn').addEventListener('click', () => {
    win.minimize();
})
let isMaximized = false;
document.querySelector('#maximize-btn').addEventListener('click', () => {
    win.isMaximized() ? win.unmaximize() : win.maximize()
    // Hack for frameless transparent window
    // console.log(win.isMaximized())
    // if(isMaximized) {
    //     win.unmaximize()
    //     isMaximized = false;
    // }
    // else {
    //     win.maximize();
    //     isMaximized = true;
    // }
})
document.querySelector('#close-btn').addEventListener('click', () => {
    win.close();
})

// Mock metadata for testing with sqlite
let md = require('./mockdata.js');

// Allowed music formats
const musicExtensions = ['.m4a', '.mp3'];

// opening directry add dialog on btn click
document.querySelector('#selectBtn').addEventListener('click', () => {
    showAddDialog()
        .then((directory) => {
            // got directory, calling recursiveReadDir to get all music files in directory
            recursiveReadDir(directory)
                .then(musicFiles=> {
                    // got all music files, calling getAllMetadata
                    getAllMetadata((musicFiles))
                        .then(metadata => {
                            // got all metadata, calling pushToDatabase
                            pushToDatabase(metadata)
                                .then(data => {
                                    // insertion success
                                    console.log(data)
                                })
                                .catch(err => { console.error(err) });
                            console.log(metadata);
                        })
                        .catch(err => { console.error(err) });
                    console.log(musicFiles);
                })
                .catch(err => { console.error(err) });
            console.log(directory);
        })
        .catch((err) => { console.error(err) });
});

function showAddDialog() {
    return new Promise((resolve, reject) => {
        // Selecting music directory
        dialog.showOpenDialog({
            title: 'Select Music Folder',
            properties: [
                'openDirectory'
            ]
        }, (directory) => {
            if(directory) resolve(directory)
            else reject('No directory selected')
        })
    });
}

// Reading music directory recursively for music files then sending music files to getAllMetadata()
function recursiveReadDir(directory) {
    return new Promise((resolve, reject) => {
        const dirPath = directory[0];
        recursiveRead(dirPath)
            .then(files => {
                // Filter all files to only get music files
                getMusicFiles(files)
                    .then(musicFiles => {
                        // Getting all metatdata from music files                    
                        if(musicFiles) resolve(musicFiles)
                        else reject('Failed to fetch music files');
                    })
                    .catch(err => {
                        console.error(err)
                    })
            })
            .catch(err => {
                console.error(err);
            })
            console.log(dirPath);
    })
    
}

// Filtering out only music files from all files
function getMusicFiles(files) {
    return new Promise((resolve, reject) => {
        let musicFiles = files.filter(file => musicExtensions.includes(path.extname(file)))
        if(musicFiles) resolve(musicFiles)
        else reject('failed to get music files')
    })
}

// Getting all the metadata from music files
function getAllMetadata(musicFiles) {
    return new Promise((resolve, reject) => {

        let allMusicPromises = [];

        // Pushing all promises for metadata extraction to an array
        musicFiles.forEach(file => {
            allMusicPromises.push(mm.parseFile(file,{ skipCovers: true }));
        })
        
        // Resolving all promises
        Promise.all(allMusicPromises)
            .then(allMetadata => {
                // Adding music file path and file creation date to metadata information
                allMetadata.map((trackData, index) => {
                    trackData.path = musicFiles[index];
                    trackData.birthtimeMs = fs.statSync(musicFiles[index]).birthtimeMs;
                });
                // Final needed data ready to push to database
                if(allMetadata) resolve(allMetadata)
            })
            .catch(err => {
                reject(err)
                console.error(err)
            })
    });
}


// Data persistance using sqlite3

// Cretaing new database file
let db = new sqlite3.Database('mystt.db');

//pushing final metadata to sqlite database
function pushToDatabase(data) {
    return new Promise((resolve, reject) => {
        let pushedTracksPromises = [];
        db.serialize(function() {
            db.run("DROP TABLE Music");
            db.run("CREATE TABLE IF NOT EXISTS Music (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, album TEXT, artist TEXT, year INT, duration INT, plays INT, favourite INT, birthtime INT, path TEXT)");
            let stmt = db.prepare("INSERT INTO Music (title, album, artist, year, duration, plays, favourite, birthtime, path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
            db.parallelize(() => {
                data.forEach(track => {
                    pushedTracksPromises.push(
                        // pushing promises to all 
                        new Promise((resolve, reject) => {
                            stmt.run(track.common.title, track.common.album, track.common.artist, track.common.year, track.format.duration, 0, 0, track.birthtimeMs, track.path, (err) => {
                                if(err) reject(err)
                                else resolve('successfully inserted')
                            });
                        })
                    )
                    
                })
            })
            stmt.finalize(); 
            // verifying if all the tracks got successfully pushed
            Promise.all(pushedTracksPromises)
                .then(data => {
                    resolve({ complete: data })
                })
                .catch(err => {
                    reject(err)
                    console.error(err)
                })
        });
        // db.close((err) => {
        //     if(err) console.error(err)
        //     else console.log('connection to database closed.')
        // });
    })
}

// Fething music from database 
// title COLLATE NOCASE ASC
// birthtime DESC - for recently added
function fetchMusic(args = "ORDER BY title COLLATE NOCASE ASC") {
    let fetchedMusic = [];
    return new Promise((resolve, reject) => {
        db.each(`SELECT id, title, album, artist, year, duration, plays, favourite, birthtime, path FROM Music ${args}`, (err, row) => {
            let track = {
                id: row.id,
                title: row.title,
                album: row.album,
                artist: row.artist,
                year: row.year,
                duration: row.duration ? row.duration : 0,
                plays: row.plays,
                favourite: row.favourite,
                birthtime: row.birthtime,
                path: row.path
            }
            fetchedMusic.push(track);
            if(err) console.error(err);
        }, (err, data) => {
            if(data) resolve(fetchedMusic)
            else if(data == 0) resolve(null)
            if(err) reject(err)
        });
    })
}

// Generating home page
generateHomePage()
    .then(data => console.log(data))
    .catch(err => console.error(err))

function generateHomePage(withTop5 = true) {
    const allHomePromises = [];
    let homeMusicCards = '';
    let homeMusicRecents = `
        <li class="infoRow" id="categoryRow">
            <p>Title</p>
            <p>Album</p>
            <p>Artist</p>
            <p>Duration</p>
            <p>Liked</p> 
        </li>
    `;
    return new Promise((resolve, reject) => {
        fetchMusic('ORDER BY birthtime DESC LIMIT 15')
        .then(data => {
            data.forEach((track, index) => {
                // console.log(track);
                // For top 5 recent tracks
                if(index < 5 && withTop5) {
                    allHomePromises.push(
                        new Promise((resolve, reject) => {
                            mm.parseFile(track.path).then(metadata => {
                                let datajpg = metadata.common.picture[0].data ? blobTob64(metadata.common.picture[0].data) : './assets/images/art.png'; 
                                homeMusicCards += `
                                    <div id="homeMusicCard" data-id=${track.id} data-title="${track.title}" data-album="${track.album}" data-artist="${track.artist}" data-path="${track.path}" data-duration="${track.duration}">
                                        <img src="${datajpg}" id="homeMusicCardArt">
                                        <p id="homeMusicCardTitle">${track.title}</p>
                                        <p id="homeMusicCardArtist">${track.artist}</p>
                                    </div>
                                `
                                if(metadata) resolve(`got art for ${track.title}`) 
                                else reject(`failed to get art for ${track.title}`)
                            })
                        })
                    )                       
                } else {
                    // for rest 10 recent tracks
                    allHomePromises.push(
                        new Promise((resolve, reject) => {
                            homeMusicRecents += `
                                <li class="infoRow" data-id=${track.id} data-title="${track.title}" data-album="${track.album}" data-artist="${track.artist}" data-path="${track.path}" data-duration="${track.duration}">
                                    <p>${track.title}</p>
                                    <p>${track.album}</p>
                                    <p>${track.artist}</p>
                                    <p>${secondsToMinutes(track.duration)}</p>
                                    <p><span id="likeHeart" onclick="likeTrack(event)" data-track-id="${track.id}" data-liked="${track.favourite}" class="typcn ${track.favourite ? 'typcn-heart' : 'typcn-heart-outline'}"></span></p> 
                                </li>
                            `
                            if(track) resolve('recent added', track.title)
                            else reject('problem with track', track)
                        })
                    )
                }
            })

            Promise.all(allHomePromises)
            .then(data => {
                // console.log(data);
                // Opening and updating file
                fs.readFile('./pages/home.htm', 'utf-8', (err, data) => {
                    if(err) console.err(err);
                    const jsdomWindow = new JSDOM(data).window;
                    // only update if withTop5 is true
                    if(withTop5) jsdomWindow.document.querySelector('#homeMusicRow').innerHTML = homeMusicCards;
                    jsdomWindow.document.querySelector('#homeMusicRecent>ul').innerHTML = homeMusicRecents;
                    const generatedContent = jsdomWindow.document.documentElement.outerHTML;                    
                    fs.writeFile('./pages/home.htm', generatedContent, (err) => {
                        if(err) reject(err)
                        else resolve(`home page generated ${withTop5 ? 'with top 5' : 'without top 5'}`)
                    })  

                })                
            }) 

        })
    })
}

// Generating songs page
generateSongsPage()
    .then(data => console.log(data))
    .catch(err => console.error(err))

function generateSongsPage() {
    let allSongs = '';
    return new Promise((resolve, reject) => {
        fetchMusic()
            .then(data => {
                data.forEach(track => {
                    // console.log(track);
                    allSongs += `
                    <li class="infoRowSongs" data-id=${track.id} data-title="${track.title}" data-album="${track.album}" data-artist="${track.artist}" data-path="${track.path}" data-duration="${track.duration}">
                        <p class="songName">${track.title}</p>
                        <p class="songAlbum">${track.album}</p>
                        <p class="songArtist">${track.artist}</p>
                        <p class="songTime">${secondsToMinutes(track.duration)}</p>
                        <p class="songYear">${track.year ? track.year : '-'}</p>
                        <p class="songLiked"><span style="display: none;">${track.favourite ? 'Heart' : 'Nope'}</span> <span id="likeHeart" onclick="likeTrack(event)" data-track-id="${track.id}" data-liked="${track.favourite}" class="typcn ${track.favourite ? 'typcn-heart' : 'typcn-heart-outline'}"></span></p> 
                    </li>
                    `
                })
                fs.readFile('./pages/songs.htm', 'utf-8', (err, data) => {
                    if(err) console.error(err);
                    const jsdomWindow = new JSDOM(data).window;
                    jsdomWindow.document.querySelector('#songsContainer>ul').innerHTML = allSongs;
                    const generatedContent = jsdomWindow.document.documentElement.outerHTML;
                    fs.writeFile('./pages/songs.htm', generatedContent, (err) => {
                        if(err) reject(err)
                        else resolve("songs page generated")
                    })  
                })
            })
    })
}

// Generating liked page
generateLikedPage()
    .then(data => console.log(data))
    .catch(err => console.error(err))

function generateLikedPage() {
    let allLiked = '';
    return new Promise((resolve, reject) => {
        fetchMusic('WHERE FAVOURITE = 1 ORDER BY title COLLATE NOCASE ASC')
            .then(data => {
                if(data) data.forEach(track => {
                    // console.log(track);
                    allLiked += `
                    <li class="infoRowLiked" data-id=${track.id} data-title="${track.title}" data-album="${track.album}" data-artist="${track.artist}" data-path="${track.path}" data-duration="${track.duration}">
                        <p class="likedName">${track.title}</p>
                        <p class="likedAlbum">${track.album}</p>
                        <p class="likedArtist">${track.artist}</p>
                        <p class="likedTime">${secondsToMinutes(track.duration)}</p>
                        <p class="likedYear">${track.year ? track.year : '-'}</p>
                        <p class="likedLiked"><span style="display: none;">${track.favourite ? 'Heart' : 'Nope'}</span> <span id="likeHeart" onclick="likeTrack(event)" data-track-id="${track.id}" data-fromliked='true' data-liked="${track.favourite}" class="typcn ${track.favourite ? 'typcn-heart' : 'typcn-heart-outline'}"></span></p> 
                    </li>
                    `
                })
                fs.readFile('./pages/liked.htm', 'utf-8', (err, data) => {
                    if(err) console.error(err);
                    const jsdomWindow = new JSDOM(data).window;
                    jsdomWindow.document.querySelector('#likedContainer>ul').innerHTML = allLiked;
                    const generatedContent = jsdomWindow.document.documentElement.outerHTML;
                    fs.writeFile('./pages/liked.htm', generatedContent, (err) => {
                        if(err) reject(err)
                        else resolve("liked page generated")
                    })  
                })
            }).catch(err => console.error(err));
            
    })
}



//  To convert image blobs to usable base64 images
function blobTob64(blob) {
    return("data:image/jpg;base64," + btoa(new Uint8Array(blob).reduce((data, byte) => data + String.fromCharCode(byte), '')));
}

// To convert seconds to MM:SS format
function secondsToMinutes(duration) {
    let minutes = Math.floor(duration/60);
    let seconds = Math.floor(duration) - minutes*60;
    if(seconds.toString().length == 1) seconds = `0${seconds}`;
    return(`${minutes}:${seconds}`);
}


// Functions to load various pages

function loadHomePage (e) {
    if(e) highlightSbLink(e);
    // Loading artists page in #main content at start
    $('#main').fadeOut('slow',function(){
        $('#main').load('./pages/home.htm',function(data){
           $('#main').fadeIn('slow'); 
       });
   })
}

function loadArtistsPage (e) {
    if(e) highlightSbLink(e);
    // Loading artists page in #main content at start
    $('#main').fadeOut('slow',function(){
        $('#main').load('./pages/artists.htm',function(data){
           $('#main').fadeIn('slow'); 
       });
   })
}

function loadSongsPage (e) {
    if(e) highlightSbLink(e);
    // Loading artists page in #main content at start
    $('#main').fadeOut('slow',function(){
        $('#main').load('./pages/songs.htm',function(data){
           $('#main').fadeIn('slow');           
       });
   })
}

function loadAlbumsPage (e) {
    if(e) highlightSbLink(e);
    // Loading artists page in #main content at start
    $('#main').fadeOut('slow',function(){
        $('#main').load('./pages/albums.htm',function(data){
           $('#main').fadeIn('slow'); 
       });
   });
}

function loadArtistsPage (e) {
    if(e) highlightSbLink(e);
    // Loading artists page in #main content at start
    $('#main').fadeOut('slow',function(){
        $('#main').load('./pages/artists.htm',function(data){
           $('#main').fadeIn('slow'); 
       });
   })
}

function loadLikedPage (e) {
    if(e) highlightSbLink(e);
    // Loading artists page in #main content at start
    $('#main').fadeOut('slow',function(){
        $('#main').load('./pages/liked.htm',function(data){
           $('#main').fadeIn('slow'); 
       });
   })
}


//  Making sidebar links work here

sbDiscoverLink.addEventListener('click', loadHomePage)
sbSongsLink.addEventListener('click', loadSongsPage)
sbAlbumsLink.addEventListener('click', loadAlbumsPage)
sbArtistsLink.addEventListener('click', loadArtistsPage)
sbLikedLink.addEventListener('click', loadLikedPage)

loadHomePage();


// Highligting current page

function highlightSbLink(event) {
    sbLinks.forEach(link => link.classList.remove('sbSelected'))
    event.target.classList.add('sbSelected');
}

// Liking dis-liking track

function likeTrack(e) {
    let icon = e.target;
    let iconParent = icon.parentElement;
    let isLiked = parseInt(e.target.dataset.liked);
    let trackId = e.target.dataset.trackId;

    //changing icon
    if(isLiked) {
        // animate icon
        iconParent.classList.remove('animated', 'heartBeat');
        iconParent.classList.add('animated', 'jello');

        // updating like status
        db.run(`UPDATE Music SET favourite = 0 WHERE id = ${trackId}`, (err) => {
            if(err) console.error(err);
            // checking if row on liked page to hide item instantly from page
            // iconParent is heart container and its parent is music row
            if(icon.dataset.fromliked) {
                iconParent.parentElement.addEventListener('animationend', () => {iconParent.parentElement.style = "display: none;"} )
                iconParent.parentElement.classList.add('animated', 'fadeOut')
            }

            console.log(`${trackId} set like to 0`);
            // updating for data liked for cached page
            e.target.dataset.liked = 0;
            generateLikedPage().then(data => console.log(data)).catch(err => console.error(err));
            generateSongsPage().then(data => console.log(data)).catch(err => console.error(err));
            // causing micro lags
            // generateHomePage(false).then(data => console.log(data)).catch(err => console.error(err));
        });

        icon.classList.remove('typcn-heart');
        icon.classList.add('typcn-heart-outline');
    } else {
        // animate icon
        iconParent.classList.remove('animated', 'jello');
        iconParent.classList.add('animated', 'heartBeat');

        db.run(`UPDATE Music SET favourite = 1 WHERE id = ${trackId}`, (err) => {
            if(err) console.error(err);
            console.log(`${trackId} set to like 1`);
            // updating for data liked for cached page
            e.target.dataset.liked = 1;
            generateLikedPage().then(data => console.log(data)).catch(err => console.error(err));
            generateSongsPage().then(data => console.log(data)).catch(err => console.error(err));
            // causing micro lags
            // generateHomePage(false).then(data => console.log(data)).catch(err => console.error(err));
            isLiked = isLiked ? 0 : 1;
        });

        icon.classList.remove('typcn-heart-outline');
        icon.classList.add('typcn-heart');
    }

    
}

// exporting then calling with onclick on likeIcon iteself
module.exports.likeTrack = likeTrack;