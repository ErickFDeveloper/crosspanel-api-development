const { ObjectID } = require('bson');
const { MongoServerError } = require('mongodb');
const initDbConnection = require('../config/db');
const IResponseMessage = require('../interfaces/ResponseMessage');

class Expense
{
   static findExpenses ({ companyId, fields, currentPage, itemsPerPages, recurringExpenses })
   {
        return new Promise ( async (resolve, reject) => {
            try {
                const find = { companyId, isRecurrent: { $exists: false } }

                if (recurringExpenses) find.isRecurrent = true

                console.log(recurringExpenses)
                const { db, mongoClient } = await initDbConnection()
                const expenses = await db.collection('expenses').find(find).skip(currentPage).limit(itemsPerPages).project(fields).sort({ _id: -1 }).toArray()

                mongoClient.close()
                return resolve({ status: true, expenses })
            } catch (err) {
                console.error('[findExpenses] in modal -> ', err)
                return reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }
        })
   }

   static findExpenseById({ expenseId, fields })
   {
        return new Promise ( async (resolve, reject) => {
            try {
                const _id = new ObjectID(expenseId)
                const { db, mongoClient } = await initDbConnection()
                const expense = await db.collection('expenses').find({ _id }).project(fields).toArray()

                mongoClient.close()
                return resolve({ status: true, expense: expense[0] })
            } catch (err) {
                console.error('[findExpenseById] -> ', err)
                return reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }
        })
   }

    static saveExpense (expense)
    {
        return new Promise ( async (resolve, reject) => {
            try {
                const { db, mongoClient } = await initDbConnection()
                
                let query = null;

                if (expense._id){ /** EDITAR GASTO */
                    const _id = new ObjectID(expense._id)
                    delete expense._id
                    
                    query = await db.collection('expenses').updateOne({ _id }, { $set: { ...expense } })

                } else { /** AGREGAR GASTO */
                    query = await db.collection('expenses').insertOne(expense)
                }

                if (!query) 
                {
                    return resolve({ status: false, message: IResponseMessage.INVENTORY.UNEXPECTED_ERROR })
                }

                mongoClient.close()
                return resolve({ status: true, insertedId: query.insertedId, message: IResponseMessage.SYSTEM.DATA_SAVED })
            } catch (error){
                console.error('[saveExpense] -> ', error)
                return reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }
        })
    }

    static deleteExpense ({ expenseId })
    {
        return new Promise ( async (resolve, reject) => {
            try {
                const _id = new ObjectID(expenseId)
                const { db, mongoClient } = await initDbConnection()
                const response = await db.collection('expenses').deleteOne({ _id })

                if (!response) {
                    return resolve({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
                }

                mongoClient.close()
                return resolve({ status: true, message: IResponseMessage.EXPENSE.EXPENSE_DELETED })
            } catch (error) {
                console.error('[deleteExpense] -> ', error)
                return reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }
        })
    }

    static findExpensesByFilter ( { companyId, filter = [] } )
    {
        return new Promise ( async (resolve, reject) => {
            try {
                filter.unshift({ $match: { companyId } }) // FILTRAR POR EMPRESA

                const { db, mongoClient } = await initDbConnection()
                const expenses = await db.collection('expenses').aggregate( filter ).toArray();

                mongoClient.close()
                return resolve({ status: true, expenses })
            } catch (error) {
                console.error('[findExpensesByFilter] -> ', error)
                return reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }
        }) 
    }
}

module.exports = Expense