const Router = require('express').Router();
const HomeController = require('../controller/HomeController');

Router.get('/', HomeController.index);

module.exports = Router;
