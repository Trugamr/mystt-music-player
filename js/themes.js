function applyTheme(value, options = { by: 'name' }) {
    if(options.by == 'name') theme = allThemes[`${value}`];
    document.documentElement.style.setProperty('--primary-color', theme.first);
    document.documentElement.style.setProperty('--primary-color-light', theme.second);
    document.documentElement.style.setProperty('--primary-color-white', theme.third);
    document.documentElement.style.setProperty('--primary-color-gray', theme.fourth);
    document.documentElement.style.setProperty('--primary-color-gray-light', theme.fifth);
}

const allThemes = {
    darkOnyx: {
        name: 'darkOnyx',
        first: '#1e1e35',
        second: '#2e2e4e',
        third: '#ffffff',
        fourth: '#c4c4c4',
        fifth: '#e2e2e2'
    },
    hotDark: {
        name: 'hotDark',
        first: '#000000',
        second: '#161616',
        third: '#ffffff',
        fourth: '#db3e9b',
        fifth: '#ababab'
    },
    oldMacOs: {
        name: 'oldMacOs',
        first: '#eeeeee',
        second: '#cecece',
        third: '#2c2c2c',
        fourth: '#333333',
        fifth: '#575757'
    },
    amBlue: {
        name: 'amBlue',
        first: '#2d93c1',
        second: '#66cfff',
        third: '#e5f7ff',
        fourth: '#effaff',
        fifth: '#ccefff'
    },
    darkOne: {
        name: 'darkOne',
        first: '#0f0f0f',
        second: '#2d2e2e',
        third: '#bcabae',
        fourth: '#716969',
        fifth: '#fbfbfb'
    },
    russianViolet: {
        name: 'russianViolet',
        first: '#521945',
        second: '#912f56',
        third: '#eaf2ef',
        fourth: '#dbabbe',
        fifth: '#edd2e0'
    },
    periWinkle: {
        name: 'periWinkle',
        first: '#c6d8ff',
        second: '#71a9f7',
        third: '#4c1036',
        fourth: '#72195a',
        fifth: '#6b5ca5'
    }
}

module.exports.applyTheme = applyTheme;
module.exports.allThemes = allThemes;