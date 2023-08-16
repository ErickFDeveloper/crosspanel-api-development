const IResponseMessage = require('../interfaces/ResponseMessage');
const Client = require('../models/Client');
const Company = require('../models/Company');
const Expense = require('../models/Expense');
const Inventory = require('../models/Inventory');
const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const Token = require('../utils/token');
const dayjs = require('dayjs')

class DashboardController
{
    static async getBusinessHome (req, res)
    {   
        try {
            const token = Token.getData(req)
            const companyId = token.companyId

            /** OBTENER FECHAS PARA EL REPORTE */
            const startDate = dayjs().subtract(7, 'day').valueOf();
            const finalDate = dayjs().valueOf();

            const products = await Inventory.getProductsQuantity({ companyId })
            const sales = await Sale.getSaleQuantity({ companyId })
            const clients = await Client.getClientsQuantity({ companyId })
            const purchases = await Purchase.getPurchaseQuantity({ companyId })

            /**
             * [OBTENER REPORTES DE MONTOS]
            */
            const salesAmount = await Sale.findSalesByFilter({
                companyId: token.companyId,
                filter: [
                    {
                        $match: {
                            'payments.date': {
                                $gte: startDate,
                                $lte: finalDate
                            }
                        }
                    },
                    {
                        $unwind: "$payments"
                    },
                    {
                        $group: {
                            _id: "$payments.date",
                            amount: { $sum: "$payments.amount" }
                        }
                    },
                    {
                        $sort: { _id: 1 }
                    }
                ]
            });

            const expensesAmount = await Expense.findExpensesByFilter({
                companyId: token.companyId,
                filter: [
                    {
                        $match: {
                            isRecurrent: { $exists: false },
                            date: {
                                $gte: startDate,
                                $lte: finalDate
                            }
                        }
                    },
                    {
                        $group: {
                            _id: "$date",
                            amount: { $sum: "$amount" }
                        }
                    },
                    {
                        $sort: { _id: 1 }
                    }
                ]
            });

            const purchasesAmount = await Purchase.findPurchasesByFilter({
                companyId: token.companyId,
                filter: [
                    {
                        $match: {
                            'payments.date': {
                                $gte: startDate,
                                $lte: finalDate
                            }
                        }
                    },
                    {
                        $unwind: "$payments"
                    },
                    {
                        $group: {
                            _id: "$payments.date",
                            amount: { $sum: "$payments.amount" }
                        }
                    },
                    {
                        $sort: { _id: 1 }
                    }
                ]
            });

            /**
             * [ULTIMOS MOVIMIENTOS]
            */
            let paymentMethods = await Company.getPaymentMethods({ companyId })
            paymentMethods = paymentMethods.status ? paymentMethods.paymentMethods : []

            let categories = await Company.getCategories({ companyId })
            categories = categories.status ? categories.categories : []

            const lastExpensesResponse = await Expense.findExpensesByFilter({
                companyId: token.companyId,
                filter: [
                    {
                        $match: { isRecurrent: { $exists: false } }
                    },
                    {
                        $sort: { _id: -1 }
                    },
                    {
                        $limit: 2
                    }
                ]
            });

            if (lastExpensesResponse.status) {
                const expenses = lastExpensesResponse.expenses

                expenses.forEach ( (expense, index) => {
                    const paymentMethod = paymentMethods.find( method => method._id.toString() === expense.paymentMethod )
                    lastExpensesResponse.expenses[index].paymentMethodName = paymentMethod.name

                    const categoryName = categories.find( category => category._id.toString() === expense.category )
                    lastExpensesResponse.expenses[index].categoryName = categoryName.name
                })
            }

            const lastSalesResponse = await Sale.findSalesByFilter({
                companyId: token.companyId,
                filter: [
                    { $unwind: "$payments" },
                    { $sort: { "payments.id": -1 } },
                    { $project: { _id: 0, client: 1, payments: 1 } },
                    { $limit: 3 }
                ]
            });

            if (lastSalesResponse.status) {
                const sales = lastSalesResponse.sales
            
                sales.forEach ( (sale, index) => {
                    const payment = sale.payments
                    const paymentMethod = paymentMethods.find( method => method._id.toString() === payment.paymentMethod )
                    lastSalesResponse.sales[index].paymentMethodName = paymentMethod.name
                })

            }

            res.json({ 
                status: true, 
                products,
                sales,
                clients,
                purchases,
                salesAmount: salesAmount.status ? salesAmount.sales : [],
                expensesAmount: expensesAmount.status ? expensesAmount.expenses : [],
                purchasesAmount: purchasesAmount.status ? purchasesAmount.purchases : [],
                lastExpenses: lastExpensesResponse.status ? lastExpensesResponse.expenses : [],
                lastSales: lastSalesResponse.status ? lastSalesResponse.sales : []
            })
        } catch (error){
            console.error('[] -> ', error)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }
}

module.exports = DashboardController