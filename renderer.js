// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.
// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

const { dialog } = require('electron').remote
const recursiveRead = require('recursive-readdir') 
const path = require('path')
const mm = require('music-metadata')
const fs = require('fs')
const sqlite3 = require('sqlite3')

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
                
            
            db.each("SELECT id , title, album, artist, duration, plays, favourite, birthtime, path FROM Music", function(err, row) {
                console.log({id: row.id, title: row.title, artist: row.artist, duration: row.duration, plays: row.plays, favourite: row.favourite, birthtime: row.birthtime, path: row.path});
                if(err) console.error(err);
            });
        });
        db.close((err) => {
            if(err) console.error(err)
            else console.log('connection to database closed.')
        });
    })
}

