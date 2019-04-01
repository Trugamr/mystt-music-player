// list.js settings and init
var options = {
    valueNames: [
        'songName',
        'songAlbum',
        'songArtist',
        'songTime',
        'songYear',
        'songLiked'
    ],
    searchClass : 'songSearch',
    sortClass : 'songSort'
}

var songsList = new List('songsContainer', options);

// changing sorting icons
var songSortCategories = Array.from(document.querySelectorAll('.songSort'));
songSortCategories.forEach(category => {
    category.addEventListener('click', handleSortingIcons);
})

function handleSortingIcons(e) {
    
    // childNodes[1] targets typicon span
    var iconSpan = e.target.childNodes[1];

    // removing sorting icon from other categories
    songSortCategories.forEach(category => {
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
        'songName',
        'songAlbum',
        'songArtist',
        'songTime',
        'songYear',
        'songLiked'
    ],
    searchClass : 'songSearch',
    sortClass : 'songSort'
}

var songsList = new List('songsContainer', options);

// Context menu            
function createContextMenu() {
    // Destroy if context menu is already created
    $.contextMenu( 'destroy', '.infoRowSongs' );

    var myItems = {
        addToPlaylist: {
            name: 'Add To',
            items: {}
        },
        "sep1": "---------",
        createNewPlaylist: {
            name: 'Create New'
        }
    }

    fetchPlaylistNames().then(data => {                    
        data.forEach(playlist => {
            myItems.addToPlaylist.items[playlist] = { name: playlist }
        })
        $.contextMenu({
            selector: '.infoRowSongs',
            callback: function(option, trigger) {
                if(option == 'createNewPlaylist') {
                    var createPlaylistModal = new tingle.modal({
                        closeMethods: ['overlay', 'escape'],
                        cssClass: ['createNewPlaylistModal']
                    })

                    // Create new playlist input field
                    createPlaylistModal.setContent(`
                        <input type="text" id="playlistInput" placeholder="Playlist Name" />
                        <button id="createPlaylistBtn">Create</button>
                    `)
                    createPlaylistModal.open();
                    document.querySelector('#createPlaylistBtn').addEventListener('click', (e) => {
                        createNewPlaylist(document.querySelector('#playlistInput').value).then(data => {
                            console.log(data);
                            createPlaylistModal.destroy();
                            // destory and recreate context menu to show newly created playlist
                            $.contextMenu( 'destroy', '.infoRowSongs' );
                            createContextMenu();
                        }).catch(err => console.error(err));
                    })


                } else {
                    var trackDataset = trigger.$trigger[0].dataset;
                    var track = {
                        id: trackDataset.id,
                        title: trackDataset.title,
                        album: trackDataset.album,
                        artist: trackDataset.artist,
                        year: trackDataset.year,
                        duration: trackDataset.duration,
                        path: trackDataset.path
                    }
                    addToPlaylist(track, option);
                    console.log(track);
                }                            
            },
            items: myItems
        })                
    })
}            

createContextMenu();