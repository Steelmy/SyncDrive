const Store = require('electron-store');
const { app } = require('electron');

const store = new Store({
  cwd: app.getPath('userData')
});

module.exports = store;