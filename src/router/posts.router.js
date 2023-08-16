const Router = require('express').Router();
const multer = require('multer');
const auth = require('../middlewares/auth');

const PostController = require('../controller/PostController');

/**
 * [GET ROUTES]
 */

 Router.get('/all', auth, PostController.getAllPosts);
 Router.get('/find', auth, PostController.find);
 Router.get('/find-by-slug', auth, PostController.findBySlug);

 /**
  * [POST ROUTES]
  */
Router.post('/create', auth, multer().none(), PostController.create);
Router.post('/update', auth, multer().none(), PostController.update);
Router.post('/delete', auth, multer().none(), PostController.deleteOne);

module.exports = Router;