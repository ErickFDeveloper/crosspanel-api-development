const Router = require('express').Router();
const ContactsController = require('../controller/ContactsController');
const multer = require('multer');

Router.post('/save-client', multer().none(), ContactsController.SaveClient);
Router.post('/delete-client', multer().none(), ContactsController.DeleteClient);
Router.post('/find-client', ContactsController.findClient);
Router.post('/get-client-list', ContactsController.GetClientList);
Router.post('/get-client', ContactsController.GetClient);

/**
 * [PROVIDETS]
*/
Router.get('/get-provider-view', ContactsController.getProviderView);
Router.post('/save-provider', multer().none(), ContactsController.saveProvider);
Router.post('/delete-provider', multer().none(), ContactsController.deleteProvider);
Router.post('/get-provider-list', multer().none(), ContactsController.getProviders);
Router.get('/get-provider', ContactsController.getProvider);

module.exports = Router;
