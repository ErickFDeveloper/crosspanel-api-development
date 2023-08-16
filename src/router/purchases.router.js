const Router = require('express').Router();
const PurchasesController = require('../controller/PurchasesController');
const multer = require('multer');

/**
 * [POST]
*/
Router.post('/get-purchase-stats', PurchasesController.getPurchaseStats);
Router.post('/save-purchase', multer().none(), PurchasesController.savePurchase);
Router.post('/get-purchases', PurchasesController.getPurchases)
Router.post('/get-purchase', PurchasesController.getPurchase)
Router.post('/delete-purchase', PurchasesController.deletePurchase)
Router.post('/get-add-payment-view', PurchasesController.getAddPaymentView)
Router.post('/save-payment', multer().none(), PurchasesController.savePayment)

/**
 * [GET]
*/
Router.get('/get-payments', PurchasesController.getPayments)
Router.get('/delete-payment', PurchasesController.deletePayment)

module.exports = Router;
