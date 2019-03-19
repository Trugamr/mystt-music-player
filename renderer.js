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

// Get current window and creating custom min, max, close buttons
let win = remote.getCurrentWindow();
document.querySelector('#minimize-btn').addEventListener('click', () => {
    win.minimize();
})
let isMaximized = false;
document.querySelector('#maximize-btn').addEventListener('click', () => {
    win.isMaximized() ? win.unmaximize() : win.maximize()
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
            db.run("CREATE TABLE IF NOT EXISTS Music (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, album TEXT, artist TEXT, duration INT, plays INT, favourite INT, birthtime INT, path TEXT)");
            let stmt = db.prepare("INSERT INTO Music (title, album, artist, duration, plays, favourite, birthtime, path) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
            db.parallelize(() => {
                data.forEach(track => {
                    pushedTracksPromises.push(
                        // pushing promises to all 
                        new Promise((resolve, reject) => {
                            stmt.run(track.common.title, track.common.album, track.common.artist, track.format.duration, 0, 0, track.birthtimeMs, track.path, (err) => {
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
function fetchMusic(args = "title COLLATE NOCASE ASC") {
    let fetchedMusic = [];
    return new Promise((resolve, reject) => {
        db.each(`SELECT id, title, album, artist, duration, plays, favourite, birthtime, path FROM Music ${args}`, (err, row) => {
            let track = {
                id: row.id,
                title: row.title,
                artist: row.artist,
                duration: row.duration,
                plays: row.plays,
                favourite: row.favourite,
                birthtime: row.birthtime,
                path: row.path
            }
            fetchedMusic.push(track);
            if(err) console.error(err);
        }, (err, data) => {
            if(data) resolve(fetchedMusic)
            else reject(err)
        });
    })
}

// Generating all pages
function generateHomePage() {
    return new Promise((resolve, reject) => {
        fs.readFile('./pages/home.htm', 'utf-8', function (err, data) {
            if(err) console.error(err);
            const jsdomWindow = new JSDOM(data).window;
            
            // fetching recently added music
            fetchMusic('ORDER BY birthtime DESC LIMIT 5')
            .then(music=> {
                let homeMusicRow = jsdomWindow.document.querySelector('#homeMusicRow');
                let homeMusicCards = '';
                let homeMusicPromises = [];
                music.forEach(track => {
                    let b64encoded, datajpg;
                    homeMusicPromises.push(
                        new Promise((resolve, reject) => {
                            mm.parseFile(track.path)
                            .then(metadata => {                
                                b64encoded = btoa(new Uint8Array(metadata.common.picture[0].data).reduce((data, byte) => data + String.fromCharCode(byte), ''));;
                                datajpg = "data:image/jpg;base64," + b64encoded;
                                homeMusicCards += `
                                    <div id="homeMusicCard" data-id=${track.id}>
                                        <img src="${datajpg}" id="homeMusicCardArt">
                                        <p id="homeMusicCardTitle">${track.title}</p>
                                        <p id="homeMusicCardArtist">${track.artist}</p>
                                    </div>
                                `
                                if(datajpg) resolve(`got art for ${metadata.common.title}`)
                                else reject(`failed to get art for ${metadata.common.title}`)
                            })
                        })
                    )

                })

                // making sure we get all the artworks before populating
                Promise.all(homeMusicPromises)
                    .then(data => {
                        console.log(data);
                        homeMusicRow.innerHTML = homeMusicCards;
                        const generatedPage = jsdomWindow.document.documentElement.outerHTML;
                        // Overwrite to file
                        fs.writeFile('./pages/home.htm', generatedPage, (err) => {
                            if (err) reject(err)
                            else resolve('Home page generated')
                        })
                    })
                
            })
            .catch(err => {
                console.error(err);
            })
                    
        });
    })
    
}

generateHomePage()
    .then(data => console.log(data))
    .catch(err => console.error(err))


function generateHomePageX() {
    
    fetchMusic('ORDER BY birthtime DESC LIMIT 5')
        .then(music=> {
            let homeMusicRow = document.querySelector('#homeMusicRow');
            let homeMusicCards = '';
            let homeMusicCardPromises = [];
            music.forEach(track => {
                let b64encoded, datajpg;
                homeMusicCardPromises.push(
                    new Promise((resolve, reject) => {
                        mm.parseFile(track.path)
                        .then(metadata => {                
                            b64encoded = btoa(new Uint8Array(metadata.common.picture[0].data).reduce((data, byte) => data + String.fromCharCode(byte), ''));;
                            datajpg = "data:image/jpg;base64," + b64encoded;
                            homeMusicCards += `
                                <div id="homeMusicCard" data-id=${track.id}>
                                    <img src="${datajpg}" id="homeMusicCardArt">
                                    <p id="homeMusicCardTitle">${track.title}</p>
                                    <p id="homeMusicCardArtist">${track.artist}</p>
                                </div>
                            `
                            if(datajpg) resolve(`got art for ${metadata.common.title}`)
                            else reject(`failed to get art for ${metadata.common.title}`)
                        })
                    })
                )

            })

            // making sure we get all the artworks before populating
            Promise.all(homeMusicCardPromises)
                .then(data => {
                    console.log(data);
                    homeMusicRow.innerHTML = homeMusicCards;
                })
            
        })
        .catch(err => {
            console.error(err);
        })
}

loadHomePage();

// Functions to load various pages

function loadHomePage () {
    // Loading artists page in #main content at start
    $('#main').load('./pages/home.htm');
}

function loadArtistsPage () {
    // Loading artists page in #main content at start
    $('#main').load('./pages/artists.htm');
}

function loadSongsPage () {
    // Loading artists page in #main content at start
    $('#main').load('./pages/songs.htm');
}

function loadAlbumsPage () {
    // Loading artists page in #main content at start
    $('#main').load('./pages/albums.htm');
}

function loadArtistsPage () {
    // Loading artists page in #main content at start
    $('#main').load('./pages/artists.htm');
}

function loadLikedPage () {
    // Loading artists page in #main content at start
    $('#main').load('./pages/liked.htm');
}


//  Making sidebar links work here
const sbDiscoverLink = document.querySelector('#homePage');
const sbSongsLink = document.querySelector('#songsPage');
const sbAlbumsLink = document.querySelector('#albumsPage');
const sbArtistsLink = document.querySelector('#artistsPage');
const sbLikedLink = document.querySelector('#likedPage');

sbDiscoverLink.addEventListener('click', loadHomePage)
sbSongsLink.addEventListener('click', loadSongsPage)
sbAlbumsLink.addEventListener('click', loadAlbumsPage)
sbArtistsLink.addEventListener('click', loadArtistsPage)
sbLikedLink.addEventListener('click', loadLikedPage)