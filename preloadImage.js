const recursiveRead = require('recursive-readdir');
const path = require('path');
const { app } = require("./renderer");
// EXPERIMENTAL
// Preload images
function preloadImage(url) {
    var img = new Image();
    img.src = url;
}
recursiveRead(path.join(app.getAppPath(), 'cache')).then((images) => {
    images.forEach(image => {
        preloadImage(image);
    });
});
