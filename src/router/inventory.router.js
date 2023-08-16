const Router = require('express').Router();
const InventoryController = require('../controller/InventoryController');
const multer = require('multer');

const uploadImages = require('../middlewares/uploadImages');

Router.post('/save-product', multer().none(), InventoryController.SaveProduct);
Router.post('/delete-product', InventoryController.DeleteProduct);
Router.post('/get-product', InventoryController.GetProduct);
Router.post('/get-inventory-data', InventoryController.GetInventoryData);
Router.post('/get-product-stats', InventoryController.getProductStats);
Router.post('/product-list', InventoryController.getProductList);
Router.post('/search-product', InventoryController.SearchProduct);
Router.post('/get-comprobante', InventoryController.getComprobante);
Router.post('/delete-comprobante', InventoryController.deleteComprobante);
Router.post('/get-next-secuence', InventoryController.getNextSecuence);
Router.post('/general-view', InventoryController.generalView);

/**
 * [SERVICIOS]
*/
Router.post('/save-service', multer().none(), InventoryController.saveService);
Router.post('/service-list', InventoryController.getServices);
Router.post('/get-service', InventoryController.getService);
Router.post('/delete-service', InventoryController.deleteService);


module.exports = Router;