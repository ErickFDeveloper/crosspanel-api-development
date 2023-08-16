const Router = require('express').Router();
const AuthController = require('../controller/AuthController');

const multer = require('multer');

Router.post('/validate-token', AuthController.validateToken);
Router.post('/login', multer().none(), AuthController.login);
Router.post('/register', multer().none(), AuthController.register);
Router.post('/logout', multer().none(), AuthController.logout);

module.exports = Router;
