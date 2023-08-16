const Router = require('express').Router();
const ExpensesController = require('../controller/ExpensesController');
const multer = require('multer');

Router.post('/get-expense-list', ExpensesController.getExpenseList);
Router.get('/get-expense', ExpensesController.getExpense);
Router.post('/save-expense', multer().none(), ExpensesController.saveExpense);
Router.get('/get-expense-view', ExpensesController.getExpenseView)
Router.get('/delete-expense', ExpensesController.deleteExpense)

module.exports = Router;
