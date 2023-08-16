const Router = require('express').Router();
const DashboardController = require('../controller/DashboardController');
const multer = require('multer');

Router.post('/get-business-home', DashboardController.getBusinessHome);

module.exports = Router;
