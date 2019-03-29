// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.
// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

const { dialog } = require('electron').remote
const { remote, ipcRenderer } = require('electron')
const recursiveRead = require('recursive-readdir') 
const path = require('path')
const mm = require('music-metadata')
const fs = require('fs')
const sqlite3 = require('sqlite3')
const jsdom = require('jsdom')
const { JSDOM } = jsdom;
const Vibrant = require('node-vibrant')

// User Settings
let isDynamicThemeSelected = false;
let currentlySelectedTheme = 'darkOnyx';

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
document.querySelector('#selectBtn').addEventListener('click', addMusicFlow);
    // showAddDialog()
    //     .then((directory) => {
    //         // got directory, calling recursiveReadDir to get all music files in directory
    //         recursiveReadDir(directory)
    //             .then(musicFiles=> {
    //                 // got all music files, calling getAllMetadata
    //                 getAllMetadata((musicFiles))
    //                     .then(metadata => {
    //                         // got all metadata, calling pushToDatabase
    //                         pushToDatabase(metadata)
    //                             .then(data => {
    //                                 // insertion success
    //                                 console.log(data)
    //                             })
    //                             .catch(err => { console.error(err) });
    //                         console.log(metadata);
    //                     })
    //                     .catch(err => { console.error(err) });
    //                 console.log(musicFiles);
    //             })
    //             .catch(err => { console.error(err) });
    //         console.log(directory);
    //     })
    //     .catch((err) => { console.error(err) });

function addMusicFlow() {
    showAddDialog().then(directory => {
        console.log(`directory chosen ${directory}`)
        var addMusicFlowModal = new tingle.modal({
            closeMethods: [],
            cssClass: ['addMusicFlowModal'],
            onOpen: function() {
                var addMusicFlowStatus = document.querySelector('#addMusicFlowStatus');
                var addMusicFlowIcon = document.querySelector('#addMusicFlowIcon');
                var addMusicFlowProgress = document.querySelector('#addMusicFlowProgress');
            }
        })
        addMusicFlowModal.setContent(`
            <i id="addMusicFlowIcon" class="fas fa-redo-alt fa-spin"></i>
            <p id="addMusicFlowStatus">adding music</p>
            <progress id="addMusicFlowProgress" max=100 value="5"></progress>
        `)
        addMusicFlowModal.open();
        // Close settings panel to only show adding status modal
        handleSettingsPanel();
        addMusicFlowStatus.textContent = `scanning directory for music files`;
        addMusicFlowProgress.value = 20;
        recursiveReadDir(directory).then(musicFiles => {
            addMusicFlowStatus.textContent = `fetching metadata for ${musicFiles.length} files`;
            addMusicFlowProgress.value = 40;
            console.log(`got all music files`, musicFiles)
            getAllMetadata(musicFiles).then(metadata => {
                addMusicFlowStatus.textContent = `pushing information to database`;
                addMusicFlowProgress.value = 60;
                console.log('got all metadata', metadata)
                pushToDatabase(metadata).then(data => {
                    addMusicFlowStatus.textContent = `generating all pages`;
                    addMusicFlowProgress.value = 80;
                    console.log('pushed to database', metadata)
                    // Generating all pages now
                    Promise.all([generateHomePage(), generateSongsPage(), generateAlbumsPage(), generateArtistsPage(), generateLikedPage()])
                        .then(data => {
                            console.log('generated all pages', data);
                            addMusicFlowProgress.value = 100;
                            addMusicFlowIcon.removeAttribute("class");
                            addMusicFlowIcon.classList.add('animated', 'fas', 'fa-heart', 'heartBeat', 'infinite');
                            addMusicFlowStatus.textContent = `all set, see you on flip side`;
                            setTimeout(win.reload(), 3000);
                        })                    
                })
            })
        })
    })
}

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
// generateHomePage()
//     .then(data => console.log(data))
//     .catch(err => console.error(err))

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
                                    <div id="homeMusicCard" onclick="playMusic(${track.id})" data-id=${track.id} data-title="${track.title}" data-album="${track.album}" data-artist="${track.artist}" data-path="${track.path}" data-duration="${track.duration}">
                                        <img src="${datajpg}" id="homeMusicCardArt">
                                        <p id="homeMusicCardTitle">${track.title}</p>
                                        <p id="homeMusicCardArtist">${track.artist}</p>
                                        <p style="display: none;"><span id="likeHeart" onclick="likeTrack(event)" data-track-id="${track.id}" data-liked="${track.favourite}" class="typcn ${track.favourite ? 'typcn-heart' : 'typcn-heart-outline'}"></span></p> 
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
                                <li class="infoRow" onclick="playMusic(${track.id})" data-id=${track.id} data-title="${track.title}" data-album="${track.album}" data-artist="${track.artist}" data-path="${track.path}" data-duration="${track.duration}">
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
// generateSongsPage()
//     .then(data => console.log(data))
//     .catch(err => console.error(err))

function generateSongsPage() {
    let allSongs = '';
    return new Promise((resolve, reject) => {
        fetchMusic()
            .then(data => {
                data.forEach(track => {
                    // console.log(track);
                    allSongs += `
                    <li class="infoRowSongs" onclick="playMusic(${track.id})" data-id=${track.id} data-title="${track.title}" data-album="${track.album}" data-artist="${track.artist}" data-path="${track.path}" data-duration="${track.duration}">
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

// Generating albums page
// generateAlbumsPage()
//     .then(data => console.log(data))
//     .catch(err => console.error(err))

function generateAlbumsPage() {
    let allAlbums = '';
    return new Promise((resolve, reject) => {
        let allAlbumPromises = [];
        // fetching all albums        
        db.all(`SELECT album, artist, path, COUNT(title) as tracks FROM Music GROUP BY album`, (err, albumData) => {
            if(err) console.error(err);
            albumData
                .filter(album => album.tracks > 1)
                .forEach(album => {
                    allAlbumPromises.push(
                        new Promise((res, rej) => {
                            mm.parseFile(album.path)
                                .then(metadata => {
                                    let datajpg = metadata.common.picture[0].data ? blobTob64(metadata.common.picture[0].data) : './assets/images/art.png';
                                    allAlbums += `
                                    <div id="albumCard" onclick="showAlbumTracks('${album.album}')" data-album="${album.album}" data-artist="${album.artist}" data-tracks="${album.tracks}">
                                        <div id="albumCardArt">
                                            <img src="${datajpg}">
                                        </div>
                                        <p id="albumCardTitle">${album.album}</p>
                                        <p id="albumCardArtist">${album.artist}</p>
                                    </div>
                                    `

                                    if(metadata) res(`got metadata for ${album.album} by ${album.artist}`)
                                    else rej(`failed to get metadata for ${album.album}} by ${album.artist}`);
                                })
                        })
                    )
                });
            Promise.all(allAlbumPromises)
                .then(data => {
                    fs.readFile('./pages/albums.htm', 'utf-8', (err, data) => {
                        if(err) console.error(err);
                        const jsdomWindow = new JSDOM(data).window;
                        // only update if withTop5 is true
                        jsdomWindow.document.querySelector('#albumsContainer').innerHTML = allAlbums;
                        const generatedContent = jsdomWindow.document.documentElement.outerHTML;                    
                        fs.writeFile('./pages/albums.htm', generatedContent, (err) => {
                            if(err) reject(err)
                            else resolve(`album page generated`)
                        })  
    
                    })   
                })
                .catch(err => reject(err))
            
        })
    })
}

// Generating artists page
// generateArtistsPage()
//     .then(data => console.log(data))
//     .catch(err => console.error(err))

function generateArtistsPage() {
    let allArtists = '';
    return new Promise((resolve, reject) => {
        let allArtistsPromises = [];
        // fetching all albums        
        db.all(`SELECT artist, path, COUNT(title) as tracks FROM Music GROUP BY artist`, (err, artistData) => {
            if(err) console.error(err);
            artistData
                .filter(artist => artist.tracks > 1)
                .forEach(artist => {
                    allArtistsPromises.push(
                        new Promise((res, rej) => {
                            mm.parseFile(artist.path)
                                .then(metadata => {
                                    let datajpg = metadata.common.picture[0].data ? blobTob64(metadata.common.picture[0].data) : './assets/images/art.png';
                                    allArtists += `
                                    <div id="artistCard" onclick="showArtistTracks('${artist.artist}')" data-artist="${artist.artist}" data-tracks="${artist.tracks}">
                                        <div id="artistCardArt">
                                            <img src="${datajpg}">
                                        </div>
                                        <p id="artistCardTitle">${artist.artist}</p>
                                        <p id="artistCardTracks">${artist.tracks} tracks</p>
                                    </div>
                                    `

                                    if(metadata) res(`got metadata for ${artist.artist} with ${artist.tracks} tracks`)
                                    else rej(`failed to get metadata for ${artist.artist}} with ${artist.artist} tracks`);
                                })
                        })
                    )
                });
            Promise.all(allArtistsPromises)
                .then(data => {
                    console.log(data);
                    fs.readFile('./pages/artists.htm', 'utf-8', (err, data) => {
                        if(err) console.error(err);
                        const jsdomWindow = new JSDOM(data).window;
                        // only update if withTop5 is true
                        jsdomWindow.document.querySelector('#artistsContainer').innerHTML = allArtists;
                        const generatedContent = jsdomWindow.document.documentElement.outerHTML;                    
                        fs.writeFile('./pages/artists.htm', generatedContent, (err) => {
                            if(err) reject(err)
                            else resolve(`artists page generated`)
                        })  
    
                    })   
                })
                .catch(err => reject(err))
            
        })
    })
}

// Generating liked page
// generateLikedPage()
//     .then(data => console.log(data))
//     .catch(err => console.error(err))

function generateLikedPage() {
    let allLiked = '';
    return new Promise((resolve, reject) => {
        fetchMusic('WHERE FAVOURITE = 1 ORDER BY title COLLATE NOCASE ASC')
            .then(data => {
                if(data) data.forEach(track => {
                    // console.log(track);
                    allLiked += `
                    <li class="infoRowLiked" onclick="playMusic(${track.id})" data-id=${track.id} data-title="${track.title}" data-album="${track.album}" data-artist="${track.artist}" data-path="${track.path}" data-duration="${track.duration}">
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

// Get and show album tacks
function showAlbumTracks(albumName) {
    let album = albumName;
    let albumSongsList = '';
    fetchMusic(`WHERE album = '${album}' ORDER BY title COLLATE NOCASE ASC`)
        .then(data => {
            data.forEach(track => {
                albumSongsList += `
                <li class="infoRowAlbums" onclick="playMusic(${track.id})" data-id=${track.id} data-title="${track.title}" data-album="${track.album}" data-artist="${track.artist}" data-path="${track.path}" data-duration="${track.duration}">
                    <p class="albumName">${track.title}</p>
                    <p class="albumArtist">${track.artist}</p>
                    <p class="albumTime">${secondsToMinutes(track.duration)}</p>
                    <p class="albumLiked"><span style="display: none;">${track.favourite ? 'Heart' : 'Nope'}</span> <span id="likeHeart" onclick="likeTrack(event)" data-track-id="${track.id}" data-liked="${track.favourite}" class="typcn ${track.favourite ? 'typcn-heart' : 'typcn-heart-outline'}"></span></p> 
                </li>
                `
            })

            var modal = new tingle.modal({
                closeMethods: ['overlay', 'escape']
            })
            modal.setContent(`
                <div id="#albumTracksContainer">
                    <span id="playAlbumBtn" onclick="playMusic('${albumName}', { playBy: 'albumName', fromQueue: true })"><i class="fas fa-play"></i> Play</span>
                    <h1 id="albumNameHeading"><span>${albumName}</span></h1>
                    <li class="infoRowAlbums" id="categoryRowAlbums">
                        <p class="albumSort albumName" data-sort="albumName">Title <span class="typcn"></span></p>
                        <p class="albumSort albumArtist" data-sort="albumArtist">Artist <span class="typcn"></span></p>
                        <p class="albumSort albumTime" data-sort="albumTime">Duration <span class="typcn"></span></p>
                        <p class="albumSort albumLiked" data-sort="albumLiked">Liked <span class="typcn"></span></p> 
                    </li>
                    <ul class="list">            
                        ${albumSongsList}
                    </ul>
                </div>
            `)
            modal.open();

            // changing sorting icons
            var albumTracksSortCategories = Array.from(document.querySelectorAll('.albumSort'));
            albumTracksSortCategories.forEach(category => {
                category.addEventListener('click', handleSortingIcons);
            })

            function handleSortingIcons(e) {
                
                // childNodes[1] targets typicon span
                var iconSpan = e.target.childNodes[1];

                // removing sorting icon from other categories
                albumTracksSortCategories.forEach(category => {
                    if(category != e.target) {
                        category.childNodes[1].classList.remove('typcn-arrow-sorted-down', 'typcn-arrow-sorted-up');
                    }
                })

                // toggling/adding sorting icon
                if(iconSpan.classList.contains('typcn-arrow-sorted-down')) {
                    iconSpan.classList.remove('typcn-arrow-sorted-down');
                    iconSpan.classList.add('typcn-arrow-sorted-up');
                } else if(iconSpan.classList.contains('typcn-arrow-sorted-up')) {
                    iconSpan.classList.remove('typcn-arrow-sorted-up');
                    iconSpan.classList.add('typcn-arrow-sorted-down');
                } else {
                    iconSpan.classList.add('typcn-arrow-sorted-down');
                }
                
            }

            // list.js settings and init
            var options = {
                valueNames: [
                    'albumName',
                    'albumArtist',
                    'albumTime',
                    'albumLiked'
                ],
                sortClass : 'albumSort'
            }

            var trackList = new List('#albumTracksContainer', options);
        })
}

// Get and show album tacks
function showArtistTracks(artistName) {
    let artist = artistName;
    let artistSongsList = '';
    fetchMusic(`WHERE artist = '${artist}' ORDER BY title COLLATE NOCASE ASC`)
        .then(data => {
            data.forEach(track => {
                artistSongsList += `
                <li class="infoRowArtists" onclick="playMusic(${track.id})" data-id=${track.id} data-title="${track.title}" data-album="${track.album}" data-artist="${track.artist}" data-path="${track.path}" data-duration="${track.duration}">
                    <p class="artistName">${track.title}</p>
                    <p class="artistAlbum">${track.album}</p>
                    <p class="artistTime">${secondsToMinutes(track.duration)}</p>
                    <p class="artistLiked"><span style="display: none;">${track.favourite ? 'Heart' : 'Nope'}</span> <span id="likeHeart" onclick="likeTrack(event)" data-track-id="${track.id}" data-liked="${track.favourite}" class="typcn ${track.favourite ? 'typcn-heart' : 'typcn-heart-outline'}"></span></p> 
                </li>
                `
            })

            var modal = new tingle.modal({
                closeMethods: ['overlay', 'escape']
            })
            modal.setContent(`
                <div id="#artistTracksContainer">
                    <span id="playArtistBtn" onclick="playMusic('${artistName}', { playBy: 'artistName', fromQueue: true })"><i class="fas fa-play"></i> Play</span>
                    <h1 id="artistNameHeading"><span>${artistName}</span></h1>
                    <li class="infoRowArtists" id="categoryRowArtists">
                        <p class="artistSort artistName" data-sort="artistName">Title <span class="typcn"></span></p>
                        <p class="artistSort artistAlbum" data-sort="artistArtist">Album <span class="typcn"></span></p>
                        <p class="artistSort artistTime" data-sort="artistTime">Duration <span class="typcn"></span></p>
                        <p class="artistSort artistLiked" data-sort="artistLiked">Liked <span class="typcn"></span></p> 
                    </li>
                    <ul class="list">            
                        ${artistSongsList}
                    </ul>
                </div>
            `)
            modal.open();

            // changing sorting icons
            var artistTracksSortCategories = Array.from(document.querySelectorAll('.artistSort'));
            artistTracksSortCategories.forEach(category => {
                category.addEventListener('click', handleSortingIcons);
            })

            function handleSortingIcons(e) {
                
                // childNodes[1] targets typicon span
                var iconSpan = e.target.childNodes[1];

                // removing sorting icon from other categories
                artistTracksSortCategories.forEach(category => {
                    if(category != e.target) {
                        category.childNodes[1].classList.remove('typcn-arrow-sorted-down', 'typcn-arrow-sorted-up');
                    }
                })

                // toggling/adding sorting icon
                if(iconSpan.classList.contains('typcn-arrow-sorted-down')) {
                    iconSpan.classList.remove('typcn-arrow-sorted-down');
                    iconSpan.classList.add('typcn-arrow-sorted-up');
                } else if(iconSpan.classList.contains('typcn-arrow-sorted-up')) {
                    iconSpan.classList.remove('typcn-arrow-sorted-up');
                    iconSpan.classList.add('typcn-arrow-sorted-down');
                } else {
                    iconSpan.classList.add('typcn-arrow-sorted-down');
                }
                
            }

            // list.js settings and init
            var options = {
                valueNames: [
                    'artistName',
                    'artistAlbum',
                    'artistTime',
                    'artistLiked'
                ],
                sortClass : 'artistSort'
            }

            var trackList = new List('#artistTracksContainer', options);
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

// marked for re-generation if anytrack was liked if not don't regenerate page
let regeneratePage = {
    homePage: false,
    likedPage: false
};

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
    if(regeneratePage.songsPage) {
        regeneratePage.songsPage = false;
        generateSongsPage()
            .then(data => {
                console.log(data);
                $('#main').fadeOut('slow',function(){
                    $('#main').load('./pages/songs.htm',function(data){
                       $('#main').fadeIn('slow'); 
                   });
                })
            })
    } else {
        $('#main').fadeOut('slow',function(){
            $('#main').load('./pages/songs.htm',function(data){
               $('#main').fadeIn('slow'); 
           });
        })
    }
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
    if(regeneratePage.likedPage) {
        regeneratePage.likedPage = false;
        generateLikedPage()
            .then(data => {
                console.log(data);
                $('#main').fadeOut('slow',function(){
                    $('#main').load('./pages/liked.htm',function(data){
                       $('#main').fadeIn('slow'); 
                   });
                })
            })
    } else {
        $('#main').fadeOut('slow',function(){
            $('#main').load('./pages/liked.htm',function(data){
               $('#main').fadeIn('slow'); 
           });
        })
    }
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

    // To stop like button from triggerering row click as well
    e.stopPropagation();

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
                regenerateLikePage = true;
            }

            // marking regenration of pages
            regeneratePage.likedPage = true;
            regeneratePage.songsPage = true;

            console.log(`${trackId} set like to 0`);
            // updating for data liked for cached page
            e.target.dataset.liked = 0;
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

            // marking regenration of pages
            regeneratePage.likedPage = true;
            regeneratePage.songsPage = true;

            console.log(`${trackId} set to like 1`);
            // updating for data liked for cached page
            e.target.dataset.liked = 1;
            // causing micro lags
            // generateHomePage(false).then(data => console.log(data)).catch(err => console.error(err));
            isLiked = isLiked ? 0 : 1;
        });

        icon.classList.remove('typcn-heart-outline');
        icon.classList.add('typcn-heart');
    }

    
}


// Playing functions

const playerBar = document.querySelector('#playerBar')

const backButton = document.querySelector('#playerBackBtn');
const playButton = document.querySelector('#playerPlayBtn');
const forwardButton = document.querySelector('#playerForwardBtn');

const playerBarHeart = document.querySelector('#playerBarHeart>span')
const playerBarTitle = document.querySelector('#playerBarTitle')
const playerBarArtist = document.querySelector('#playerBarArtist')
const playerBarArt = document.querySelector('#playerBarArt>img')
const playerBarTotalTime = document.querySelector('#playerBarTotalTime')
const playerBarCurrentTime = document.querySelector('#playerBarCurrentTime')

// Player Controls
// Loading main audio element
const audioPlayer = document.querySelector('#audioPlayer');
const audioPlayerSrc = document.querySelector('#audioPlayerSrc');

// Default volume 
audioPlayer.volume = 0.35;


// Getting no. of tracks from database
let totalTracks;
db.each('SELECT COUNT(*) AS count from MUSIC', (err, data) => {
    totalTracks = data.count;
})

let currentlyPlayingTrack = 0;
let currentQueue = [];
let currentQueueTrackIndex = 0;
let playingQueue = false;

// Playing track from id
// Legacy playing function
function playTrack(trackId) {

    // start from beginning if trackId more than total tracks and start from end if trackId in negative or 0
    if(trackId > totalTracks) {
        trackId = 1;
    } else if(trackId < 1) {
        trackId = totalTracks;
    }


    fetchMusic(`WHERE id = ${trackId}`)
        .then(foundTrack => {

            let track = foundTrack[0];
            console.log(`playing ${track.title}`);

            // let track = document.querySelector(`[data-id='${trackId}']`).dataset;
            // let likeStatus = parseInt(document.querySelector(`[data-track-id='${trackId}']#likeHeart`).dataset.liked);

            currentlyPlayingTrack = track.id;

            playerBarTitle.textContent = track.title;
            playerBarArtist.textContent = track.artist;


            playerBarTotalTime.textContent = secondsToMinutes(track.duration);

            // updating play button class
            playButton.classList.remove('fa-play');
            playButton.classList.add('fa-pause');

            // Loading path and playing track
            audioPlayerSrc.src = track.path;
            audioPlayer.load();
            audioPlayer.play();

            // Updating album art
            mm.parseFile(track.path)
                .then(metadata => {
                    let datajpg = metadata.common.picture[0].data ? blobTob64(metadata.common.picture[0].data) : './assets/images/art.png';
                    playerBarArt.src = datajpg;
                })

            // Changing heart icon
            if(track.favourite) {
                playerBarHeart.dataset.trackId = track.id;
                playerBarHeart.dataset.liked = track.favourite;
                playerBarHeart.classList.remove('typcn-heart-outline');
                playerBarHeart.classList.add('typcn-heart');
            } else {
                playerBarHeart.dataset.trackId = track.id;
                playerBarHeart.dataset.liked = track.favourite;
                playerBarHeart.classList.remove('typcn-heart');
                playerBarHeart.classList.add('typcn-heart-outline');
            }
        })
}


function playMusic(data, options = { playBy: 'trackId', fromQueue: false}) {
    // Here data can be either track ID, album name or artist name 
    if(options.playBy == 'trackId') {
        let trackId = data;
        // Switching to playing shuffled/randomly if track is not from current queue;
        if(options.fromQueue) playingQueue = true;
        else playingQueue = false;

        // start from beginning if trackId more than total tracks and start from end if trackId in negative or 0
        // if(trackId > totalTracks) {
        //     trackId = 1;
        // } else if(data < 1) {
        //     trackId = totalTracks;
        // }

        fetchMusic(`WHERE id = ${trackId}`)
            .then(tracks => {
                // Loading track
                audioPlayerSrc.src = tracks[0].path;
                audioPlayer.load();
                audioPlayer.play();
                
                currentlyPlayingTrack = trackId;
                console.log('playing id', trackId);
                
                // Updating play button class
                playButton.classList.remove('fa-play');
                playButton.classList.add('fa-pause');
                
                updateCurrentlyPlayingInfo(tracks[0]);
            })
    } else if(options.playBy == 'albumName') {
        // Switching to playing queue ie an album or artist provided by array of id's
        playingQueue = true;

        fetchMusic(`WHERE album = '${data}' ORDER BY title COLLATE NOCASE ASC`)
            .then(data => {
                currentQueue = data;
                currentQueueTrackIndex = 0;
                playMusic(currentQueue[currentQueueTrackIndex].id, { playBy: 'trackId', fromQueue: true })
                console.log(currentQueue);
            });
    } else if(options.playBy == 'artistName') {
        // Switching to playing queue ie an album or artist provided by array of id's
        playingQueue = true;

        fetchMusic(`WHERE artist = '${data}' ORDER BY title COLLATE NOCASE ASC`)
            .then(data => {
                currentQueue = data;
                currentQueueTrackIndex = 0;
                playMusic(currentQueue[currentQueueTrackIndex].id, { playBy: 'trackId', fromQueue: true })
                console.log(currentQueue);
            });
    }
}

function updateCurrentlyPlayingInfo(trackInfo) {

    playerBarTitle.textContent = trackInfo.title;
    playerBarArtist.textContent = trackInfo.artist;

    playerBarCurrentTime.textContent = '0:00';
    playerBarTotalTime.textContent = secondsToMinutes(trackInfo.duration);

    // Updating playerBar heart icon and changing data attributes 
    if(trackInfo.favourite) {
        playerBarHeart.dataset.trackId = trackInfo.id;
        playerBarHeart.dataset.liked = trackInfo.favourite;
        playerBarHeart.classList.remove('typcn-heart-outline');
        playerBarHeart.classList.add('typcn-heart');
    } else {
        playerBarHeart.dataset.trackId = trackInfo.id;
        playerBarHeart.dataset.liked = trackInfo.favourite;
        playerBarHeart.classList.remove('typcn-heart');
        playerBarHeart.classList.add('typcn-heart-outline');
    }

    // Updating album art on playerBar
    mm.parseFile(trackInfo.path)
    .then(metadata => {
        let buffer = metadata.common.picture[0].data;
        let datajpg = buffer ? blobTob64(buffer) : './assets/images/art.png';
        playerBarArt.src = datajpg;
        if(isDynamicThemeSelected) dynamicColorFetch(metadata.common.picture[0].data);
    })
}


// Hooking up media buttons

function nextTrack() {
    if(playingQueue) {
        ++currentQueueTrackIndex;
        if(currentQueueTrackIndex > currentQueue.length-1) {
            currentQueueTrackIndex = 0;
            playMusic(currentQueue[currentQueueTrackIndex].id, { playBy: 'trackId', fromQueue: true });
        } else {
            playMusic(currentQueue[currentQueueTrackIndex].id, { playBy: 'trackId', fromQueue: true });
        }
    } else {
        ++currentlyPlayingTrack;
        if(currentlyPlayingTrack >= totalTracks) {
            currentlyPlayingTrack = 1;
            playMusic(currentlyPlayingTrack, { playBy: 'trackId', fromQueue: false })
        } else {
            playMusic(currentlyPlayingTrack, { playBy: 'trackId', fromQueue: false })
        }   
    } 
}

function previousTrack() {
    if(playingQueue) {
        --currentQueueTrackIndex;
        if(currentQueueTrackIndex < 0) {
            console.log('first', currentQueueTrackIndex);
            currentQueueTrackIndex = currentQueue.length-1;
            playMusic(currentQueue[currentQueueTrackIndex].id, { playBy: 'trackId', fromQueue: true });
        } else {
            console.log('second', currentQueueTrackIndex);
            playMusic(currentQueue[currentQueueTrackIndex].id, { playBy: 'trackId', fromQueue: true });
        }
    } else {
        --currentlyPlayingTrack;
        if(currentlyPlayingTrack <= 0) {
            currentlyPlayingTrack = totalTracks;
            playMusic(currentlyPlayingTrack, { playBy: 'trackId', fromQueue: false })
        } else {
            playMusic(currentlyPlayingTrack, { playBy: 'trackId', fromQueue: false })
        }
    } 
}

backButton.addEventListener('click', previousTrack)

forwardButton.addEventListener('click', nextTrack)

playButton.addEventListener('click', () => {
    if(audioPlayer.paused) {
        audioPlayer.play();
        playButton.classList.remove('fa-play');
        playButton.classList.add('fa-pause');
    } else {
        audioPlayer.pause();
        playButton.classList.remove('fa-pause');
        playButton.classList.add('fa-play');
    }
})


// Changing progress bar values
const progressBar = document.querySelector('#playerProgressBar');
const volumeBar = document.querySelector('#playerVolumeBar');

function progressTo(e) {
    e.target.value = e.offsetX/e.target.clientWidth * 100; 
    // console.log(e);
}

progressBar.addEventListener('click', (e) => {
    audioPlayer.currentTime = (e.offsetX/progressBar.clientWidth * audioPlayer.duration);
})

volumeBar.addEventListener('click', () => {
    audioPlayer.volume = volumeBar.value/100; 
})

audioPlayer.addEventListener('timeupdate', () => {
    // Updating progress bar
    if(audioPlayer.currentTime) {
        progressBar.value = audioPlayer.currentTime/audioPlayer.duration * 100;
        playerBarCurrentTime.textContent = secondsToMinutes(audioPlayer.currentTime);
    }

    // Play next track automatically after one ends
    if(audioPlayer.duration == audioPlayer.currentTime) {
        nextTrack()
    }
})


 // Settings panel
 const settingsBtn = document.querySelector('#titlebar-settings-btn')
 const settingsPanel = document.querySelector('#settingsPanel')
 const settingsPanelOverlay = document.querySelector('#settingsPanelOverlay')

 function handleSettingsPanel() {
   if(settingsPanel.classList.contains('showSettingsPanel')) {
     settingsPanel.classList.remove('showSettingsPanel');
     settingsPanelOverlay.classList.remove('showSettingsOverlay');

   } else {
     settingsPanel.classList.add('showSettingsPanel');
     settingsPanelOverlay.classList.add('showSettingsOverlay');
   }
 }

 settingsBtn.addEventListener('click', handleSettingsPanel)
 settingsPanelOverlay.addEventListener('click', handleSettingsPanel)

// FOR TESTING
// settingsBtn.click();

// Themes
var themes = require('./js/themes.js');

var lightenColor = function(color, percent) {
    var num = parseInt(color,16),
      amt = Math.round(2.55 * percent),
      R = (num >> 16) + amt,
      B = (num >> 8 & 0x00FF) + amt,
      G = (num & 0x0000FF) + amt;

      return (0x1000000 + (R<255?R<1?0:R:255)*0x10000 + (B<255?B<1?0:B:255)*0x100 + (G<255?G<1?0:G:255)).toString(16).slice(1);
};

function applyTheme(value, options = { by: 'name' }) {
    if(options.by == 'name') { theme = themes.allThemes[`${value}`] }
    else if(options.by == 'themeObject') {
        theme = value
    };
    
    // update currentlySelectedTheme so it can be saved later to database before closing
    currentlySelectedTheme = theme.name;

    if(theme.name == 'dynamic') {
        isDynamicThemeSelected = true;
    } else {
        isDynamicThemeSelected = false;
    }

    // Theme from theme object    
    document.documentElement.style.setProperty('--primary-color', theme.first);
    document.documentElement.style.setProperty('--primary-color-light', theme.second);
    document.documentElement.style.setProperty('--primary-color-white', theme.third);
    document.documentElement.style.setProperty('--primary-color-gray', theme.fourth);
    document.documentElement.style.setProperty('--primary-color-gray-light', theme.fifth);
    console.log(theme.name);
}

const themesContainer = document.querySelector('#themesContainer');
Object.keys(themes.allThemes).forEach((theme, index) => {
  themesContainer.innerHTML += `
  <div id="themeCircle" onclick="applyTheme('${themes.allThemes[theme].name}')">
    <div id="themeCircleFirst" style="background-color: ${themes.allThemes[theme].second};"></div>
    <div id="themeCircleSecond" style="background-color: ${themes.allThemes[theme].fourth};"></div>
  </div>
  `
})

// Switching to dynamic theme and setting isDynamicThemeSelected = true
let dynamicThemeBtn = document.querySelector('.dynamicThemeCircle');
dynamicThemeBtn.addEventListener('click', applyDynamicTheme)
function applyDynamicTheme() {    
    isDynamicThemeSelected = true;
    fetchMusic(`WHERE ID = ${currentlyPlayingTrack}`)
        .then(track => {
            mm.parseFile(track[0].path)
                .then(metadata => {
                    console.log(metadata);
                    dynamicColorFetch(metadata.common.picture[0].data, { by: 'themeObject' });
                })
        })    
}

function dynamicColorFetch(image) {
    // image here is b64 encoded buffer
    Vibrant.from(image, { ImageClass: Image.Node }).getPalette()
        .then(palette => {
            // Legacy
            let themeObject = {
                name: 'dynamic',
                first: palette.LightVibrant.getHex(),
                second: palette.Vibrant.getHex(),
                third: palette.DarkVibrant.getHex(),
                fourth: palette.DarkVibrant.getHex(),
                fifth: palette.DarkVibrant.getHex()
            }
            // let themeObject = {
            //     name: 'dynamic',
            //     first: palette.LightVibrant.getHex(),
            //     second: palette.Vibrant.getHex(),
            //     third: '#111111',
            //     fourth:'#1a1a1a',
            //     fifth: '#1e1e1e'
            // }

            //Text colors
            //Ligthing up highlight color by 5%
            //themeObject.second = `#${lightenColor(palette.Vibrant.getHex().replace('#',''), 0)}`
            //Darkening text colors
            themeObject.third = `#${lightenColor(palette.DarkVibrant.getHex().replace('#',''), -32)}`
            themeObject.fourth = `#${lightenColor(palette.DarkVibrant.getHex().replace('#',''), -28)}`;
            themeObject.fifth = `#${lightenColor(palette.DarkVibrant.getHex().replace('#',''), -24)}`;
            applyTheme(themeObject, { by: 'themeObject' });

            // console.log('%c DarkMuted █████ ', `color: ${palette.DarkMuted.getHex()}`)
            // console.log('%c DarkVibrant █████ ', `color: ${palette.DarkVibrant.getHex()}`)
            // console.log('%c LightMuted █████ ', `background: #000; color: ${palette.LightMuted.getHex()}`)
            // console.log('%c LightVibrant █████ ', `background: #000; color: ${palette.LightVibrant.getHex()}`)
            // console.log('%c Muted █████ ', `background: #000; color: ${palette.Muted.getHex()}`)
            // console.log('%c Vibrant █████ ', `color: ${palette.Vibrant.getHex()}`)
            // console.log(palette.LightVibrant.getHsl());
            // console.log(palette.Vibrant.getHsl());
            // console.log(palette.DarkMuted.getHsl());
            // console.log(palette);
            
        })
        .catch(err => console.error(err)); 
}

// Restoring User State 
function restoreUserState() {
    // Creating table if it doesn't exist
    // db.run("DROP TABLE Settings");
    // db.run("CREATE TABLE IF NOT EXISTS Settings (selectedTheme TEXT, lastPlayed INT");    
    db.each("SELECT selectedTheme, lastPlayed, lastPlayedDuration, progressBarValue, volume FROM Settings WHERE rowid = 1", (err, row) => {
        if(err) console.error(err);
        console.log(row);

        // Fetching lastPlayed track and updating currentlyPlayingTrack
        if(row.lastPlayed) {
            currentlyPlayingTrack = row.lastPlayed;
        } else {
            // set 1 as default last played
            currentlyPlayingTrack = 1;
        }

        // Update currently playing information
        db.each(`SELECT * FROM Music WHERE ID = ${currentlyPlayingTrack}`, (err, track) => {
            if(err) console.error(err);
            updateCurrentlyPlayingInfo(track);
            audioPlayerSrc.src = track.path;
            audioPlayer.load();
            audioPlayer.volume = row.volume/100;
            volumeBar.value = row.volume;
            audioPlayer.currentTime = row.lastPlayedDuration; 
            progressBar.value = row.progressBarValue;
            playerBarCurrentTime.textContent = secondsToMinutes(row.lastPlayedDuration);
        })

        // Fetching selectedTheme, if not avaialable setting darkOnyx as default
        if(row.selectedTheme) {
            if(row.selectedTheme == 'dynamic') {
                applyDynamicTheme()
            } else {
                applyTheme(row.selectedTheme);
            }
        } else {
            // push default theme to this column i.e darkOnyx :/
         }
    })
}

// trigger restore user state event after getting message from main process
ipcRenderer.on('restore-user-state', restoreUserState);

function saveUserState() {
    let currentSettings = [currentlySelectedTheme, currentlyPlayingTrack, audioPlayer.currentTime, progressBar.value, volumeBar.value]
    let sql = `UPDATE Settings SET selectedTheme = ?,
        lastPlayed = ?,
        lastPlayedDuration = ?,
        progressBarValue = ?,
        volume = ?
        WHERE rowid = 1`
    db.run(sql, currentSettings, (err) => {
        if(err) console.error(err);
        ipcRenderer.send('save-state-success');
    })
    
}

document.addEventListener('keypress', saveUserState);

// trigger save user state event after getting message from main process
ipcRenderer.on('save-user-state', saveUserState);

// exporting then calling with onclick on likeIcon iteself
module.exports.likeTrack = likeTrack;
module.exports.progressTo = progressTo;
module.exports.showAlbumTracks = showAlbumTracks;
module.exports.showArtistTracks = showArtistTracks;
module.exports.playTrack = playTrack;
module.exports.playMusic = playMusic;
module.exports.applyTheme = applyTheme;
module.exports.restoreUserState = restoreUserState;
module.exports.saveUserState = saveUserState;