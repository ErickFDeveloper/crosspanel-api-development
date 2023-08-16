const path = require('path');
const initDbConnection = require('../config/db');

class HomeController {
  static async index(req, res, next) {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  }
}

module.exports = HomeController;
