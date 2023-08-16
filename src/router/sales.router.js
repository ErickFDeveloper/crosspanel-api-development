const Router = require('express').Router();
const SalesController = require('../controller/SalesController');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

Router.post('/save-sale', multer().none(), SalesController.SaveSale);
Router.post('/delete-sale', multer().none(), SalesController.DeleteSale);
Router.post('/get-sales-data', SalesController.getSalesData);
Router.post('/get-sale-stats', SalesController.getSaleStats);
Router.post('/get-sale-list', SalesController.getSaleList);
Router.post('/get-sale', SalesController.GetSale);
Router.post('/save-payment', multer().none(), SalesController.savePayment);
Router.post('/get-sale-amounts', SalesController.getSaleAmounts);

Router.get('/get-payments', SalesController.getPayments);
Router.get('/delete-payment', SalesController.deletePayment);

Router.post('/send-invoice', upload.single('pdfFile'), SalesController.sendInvoice);

module.exports = Router;
