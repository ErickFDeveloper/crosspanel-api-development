const IResponseMessage = require('../interfaces/ResponseMessage');
const Expense = require('../models/Expense');
const Company = require('../models/Company');
const Provider = require('../models/Provider');
const Token = require('../utils/token');
const dayjs = require('dayjs');
const helper = require('../utils/helper');

class ExpensesController
{
    static async getExpenseView (req, res)
    {
        try {
            const token = Token.getData(req)

            const paymentMethods = await Company.getPaymentMethods({
                companyId: token.companyId
            })

            const categories = await Company.getCategories({
                companyId: token.companyId,
                fields: { name: 1 }
            })

            res.json({ 
                status: true, 
                paymentMethods: paymentMethods.status ? paymentMethods.paymentMethods : [],
                categories: categories.status ? categories.categories : []
            })
        } catch (error) {
            console.error('[saveExpense] -> ', error)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }

    static async getExpenseList (req, res)
    {
        try {
            const { currentPage, itemsPerPage, recurringExpenses } = { ...req.body }
            const token = Token.getData(req)

            /** OBTENER CANTIDAD TOTAL DE GASTOS */
            const totalResponse = await Expense.findExpenses({ companyId: token.companyId, fields: { _id: 1 }, currentPage: 0, itemsPerPages: 0 })

            const response = await Expense.findExpenses({
                companyId: token.companyId,
                fields: {
                    date: 1,
                    category: 1,
                    amount: 1,
                    paymentMethod: 1,
                    provider: 1,
                },
                currentPage: helper.getPaginationCurrentPage(currentPage, itemsPerPage),
                itemsPerPages: itemsPerPage ? itemsPerPage : 0,
                recurringExpenses: recurringExpenses ? true : false
            })

            /**
             * [BUSCAR LOS DEMAS DATOS DEL GASTO]
            */
            let expenses = Array()

            if (response.status)
            {
                expenses = response.expenses

                /** OBTENER METODOS DE PAGOS DE LA EMPRESA */
                let paymentMethods = await Company.getPaymentMethods({
                    companyId: token.companyId
                })

                paymentMethods = paymentMethods.status ? paymentMethods.paymentMethods : []

                /** OBTENER CATEGORIAS DE LA EMPRESA */
                let categories = await Company.getCategories({ 
                    companyId: token.companyId,
                    fields: {
                        name: 1
                    }
                })

                categories = categories.status ? categories.categories : []


                for ( const [key, value] of Object.entries(expenses) )
                {
                    expenses[key].date = dayjs(value.date).format('YYYY-MM-DD')

                    expenses[key].paymentMethodData = paymentMethods.find( paymentMethod => paymentMethod._id.toString() === value.paymentMethod )
                    
                    expenses[key].categoryData = categories.find( category => category._id.toString() === value.category.toString() )

                    /** OBTENER DATOS DEL PROVEEDOR */
                    if (value.provider) {
                        const responseProvider =  await Provider.getProvider({ 
                            companyId: token.companyId,
                            providerNumber: null,
                            providerId: value.provider,
                            fields: {
                                name: 1
                            }
                        })

                        expenses[key].providerData = responseProvider.status ? responseProvider.provider : { }
                    }
                }
            }

            res.json({ status: true, total: totalResponse.expenses?.length, expenses })
        } catch (err) {
            console.error('[getExpenseList] -> ', err)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }

    static async getExpense (req, res)
    {
        try {
            const { expenseId } = req.query
            const token = Token.getData(req)

            if (!expenseId)
            {
                return res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }

            const response = await Expense.findExpenseById({
                expenseId,
                fields: {
                    date: 1,
                    category: 1,
                    amount: 1,
                    paymentMethod: 1,
                    provider: 1,
                    comprobanteFiscal: 1,
                    frecuency: 1,
                    note: 1,
                    userId: 1
                }
            })

            let expense = Array()

            if (response.status)
            {
                dayjs.locale('es')

                expense = response.expense
                expense.stringDate = dayjs(expense.date).format('YYYY-MM-DD')
                expense.stringLargeDate = dayjs(expense.date).format('dddd, D [de] MMMM [de] YYYY')

                const categoryResponse = await Company.findCategoryById({
                    categoryId: expense.category,
                    fields: {
                        name: 1
                    }
                })

                const paymentResponse = await Company.findPaymentMethodById({
                    id: expense.paymentMethod,
                    fields: {
                        name: 1
                    }
                })

                expense.categoryData = categoryResponse.status ? categoryResponse.category : {}
                expense.paymentData = paymentResponse.status ? paymentResponse.paymentMethod : {}

                if (expense.provider) {
                    const providerResponse = await Provider.getProvider({
                        companyId: token.companyId,
                        providerNumber: null,
                        providerId: expense.provider,
                        fields: {
                            name: 1
                        }
                    })

                    expense.providerData = providerResponse.status ? providerResponse.provider : []
                }
            }

            res.json({ status: true, expense })
        } catch (err) {
            console.error('[getExpense] -> ', err)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }

    static async saveExpense (req, res)
    {
        try {
            const { expenseId, date, frecuency, category, amount, paymentMethod, provider, comprobanteFiscal, note } = { ...req.body }
            const token = Token.getData(req)

            if (!date) {
                return res.json({ status: false, message: IResponseMessage.EXPENSE.DATE_REQUIRED })
            }

            if (!category) {
                return res.json({ status: false, message: IResponseMessage.INVENTORY.CATEGORY_REQUIRED })
            }

            if (!amount) {
                return res.json({ status: false, message: IResponseMessage.INVENTORY.AMOUNT_REQUIRED })
            }

            if (!paymentMethod) {
                return res.json({ status: false, message: IResponseMessage.SALE.SELECT_PAYMENT_METHOD })
            }

            const expense = {
                date: dayjs(date).valueOf(),
                category,
                amount: parseFloat(amount),
                paymentMethod,
                provider,
                comprobanteFiscal,
                note,
                userId: token.userId,
                companyId: token.companyId
            }

            if (frecuency) {
                expense.frecuency = parseInt(frecuency)
                expense.isRecurrent = true
            }

            if (expenseId) {
                expense._id = expenseId
            }

            const response = await Expense.saveExpense(expense)

            if (response.status) {
                
                /**
                 * [GUARDAR NOTA]
                */
                if (expenseId) {
                    await helper.saveNote({
                        note: `Un usuario ha editado un gasto`,
                        type: 'expense',
                        typeAction: 'edit',
                        referenceId: expenseId,
                        userId: token.userId,
                        companyId: token.companyId
                    })
                } else {
                    await helper.saveNote({
                        note: `Un usuario ha registrado un gasto de ${helper.formatNumber(amount)}`,
                        type: 'expense',
                        typeAction: 'create',
                        referenceId: response.insertedId.toString(),
                        userId: token.userId,
                        companyId: token.companyId
                    })
                }
            }

            res.json(response)
        } catch (error) {
            console.error('[saveExpense] -> ', error)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }

    static async deleteExpense (req, res)
    {
        try {
            const { expenseId } = req.query

            if (!expenseId)
            {
                return res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }

            const response = await Expense.deleteExpense({
                expenseId
            })

            res.json(response)
         } catch (error) {
            console.error('[deleteExpense] -> ', error)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }
}

module.exports = ExpensesController