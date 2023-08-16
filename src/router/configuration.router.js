const Router = require('express').Router();
const ConfigurationController = require('../controller/ConfigurationController');
const multer = require('multer');

Router.post('/get-configuration-data', ConfigurationController.getConfigurationData);
Router.post('/save-general-data', multer().none(), ConfigurationController.saveGeneralData);
Router.post('/save-comprobantes', multer().none(), ConfigurationController.saveComprobantes);

Router.post('/save-establishment', multer().none(), ConfigurationController.saveEstablishment);
Router.post('/delete-establishment', ConfigurationController.deleteEstablishment);

Router.post('/get-notes', ConfigurationController.getNotes);

Router.post('/get-municipalities', ConfigurationController.getMunicipalities);
Router.post('/get-sectors', ConfigurationController.getSectors);

Router.post('/save-tax', multer().none(), ConfigurationController.saveTax);
Router.post('/delete-tax', ConfigurationController.deleteTax);

module.exports = Router;
