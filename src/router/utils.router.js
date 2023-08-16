const Router = require('express').Router();

const UtilsController = require('../controller/UtilsController');

Router.get('/get-current-date', UtilsController.getCurrentDate);
Router.get('/get-current-datetime', UtilsController.getCurrentDatetime);

module.exports = Router;