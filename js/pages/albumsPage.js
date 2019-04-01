// Context menu            
function createContextMenu() {
    // Destroy if context menu is already created
    $.contextMenu( 'destroy', '.infoRowAlbums' );

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
            selector: '.infoRowAlbums',
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