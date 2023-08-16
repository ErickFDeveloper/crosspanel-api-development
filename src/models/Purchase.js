const { ObjectID } = require('bson');
const { MongoServerError } = require('mongodb');
const initDbConnection = require('../config/db');
const IResponseMessage = require('../interfaces/ResponseMessage');
const Inventory = require('./Inventory')

class Purchase
{
    /** create and edit purchase
     * @param { object } data
     * @param { object } data.purchase Data of purchase
     * @param { int } data.purchaseNumber number of purchase
     * @param { string } data.companyId id of company
    */
    static savePurchase ({ purchase, purchaseNumber, companyId })
    {
        return new Promise ( async (resolve, reject) => {
            try {
                const { db, mongoClient } = await initDbConnection();
                let purchaseId = ''

                if (!purchaseNumber) {
                    /** REGISTRAR UNA COMPRA NUEVA */
                    const purchaseSequence = await this.GetPurchaseSequence(companyId)
                    purchase.purchaseNumber = purchaseSequence

                    const savePurchase = await db.collection('purchases').insertOne(purchase)

                    if (!savePurchase)
                    {
                        return resolve({ status: false, message: IResponseMessage.PURCHASE.CANT_SAVE_PURCHASE })
                    }
                    
                    purchaseId = savePurchase.insertedId
                    purchaseNumber = purchaseSequence
                    await this.SetPurchaseSequence(companyId, purchaseSequence)
                } else {
                    /** EDITAR UNA COMPRA EXISTENTE */
                    const editPurchase = await db.collection('purchases').updateOne({ purchaseNumber, companyId }, { $set: purchase })

                    if (!editPurchase) {
                        return resolve({ status: false, message: IResponseMessage.PURCHASE.CANT_SAVE_PURCHASE })
                    }
                }

                mongoClient.close()
                return resolve({ status: true, purchaseNumber, purchaseId, message: IResponseMessage.PURCHASE.PURCHASE_SAVED })
            } catch (error) {
                console.error('[savePurchase] -> ', error)
                return reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }
        })
    }

    static deletePurchase ( { purchaseNumber, companyId } ) {
        return new Promise ( async (resolve, reject) => {
            try {
                const { db, mongoClient } = await initDbConnection();
                const response = await db.collection('purchases').deleteOne({ purchaseNumber, companyId })

                if (!response)
                    return resolve({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })

                mongoClient.close();
                resolve({ status: true, message: IResponseMessage.PURCHASE.PURCHASE_DELETED })
            } catch (error) {
                console.error('[DeletePurchase] -> ', error)
                return reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }
        })
    }

    static getPurchaseQuantity ({ companyId })
    {
        return new Promise ( async (resolve, reject) => {
            try {
                const { db, mongoClient } = await initDbConnection()
                const purchases = await db.collection('purchases').count({ companyId })

                mongoClient.close()
                return resolve(purchases)
            } catch (error) {
                console.error('[getPurchaseQuantity] -> ', error)
                return reject(0)
            }
        })
    }

    static async getPurchaseStats ({ companyId, search }) {
        return new Promise ( async (resolve, reject) => {
            try {
                let filter = { $match: {} }
                
                if (search) {
                    filter = {
                        $match: { 'providerData.name': {$regex:  new RegExp(search, 'i') } }
                    }
                }

                const { db, mongoClient } = await initDbConnection();
                const purchases = await db.collection('purchases').aggregate([
                    {
                        $match: {
                            companyId
                        }
                    },
                    {
                        $addFields: {
                          providerId: {
                            $cond: {
                              if: { $ne: ["$provider", ""] },
                              then: { $toObjectId: "$provider" },
                              else: "$provider"
                            }
                          }
                        }
                    },
                    { /** UNIR LA COLECCION A LA DE PROVEDORES */
                        $lookup: {
                          from: "providers",
                          localField: "providerId",
                          foreignField: "_id",
                          as: "providerData"
                        }
                    },
                    { $unwind: "$providerData" },
                    filter
                ]).toArray()
                
                mongoClient.close()
                return resolve({ status: true, purchases })
            } catch ( error ) {
                console.error('[getPurchaseStats] in Model ->', error)
                return reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }
        })
    }

    static getPurchases ({ companyId, search, filterBy, currentPage, itemsPerPage })
    {
        return new Promise ( async (resolve, reject) => {
            try { 
                if (!companyId)
                    return resolve({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })

                let searchProvider = { $match: {} }

                if (search !== '') {
                    searchProvider = {
                        $match : {
                            'providerData.name': {$regex:  new RegExp(search, 'i') }
                        }
                    }
                }   

                const { db, mongoClient } = await initDbConnection()
                const purchases = await db.collection('purchases').aggregate([
                    {
                        $match: {
                            companyId,
                        }
                    },
                    { $unwind: "$products" },
                    {
                        $group: {
                            _id: "$_id",
                            purchaseNumber: { $first: "$purchaseNumber" },
                            provider: { $first: "$provider" },
                            payments: { $first: "$payments" },
                            discount: { $first: "$discount" },
                            shipping: { $first: "$shipping" },
                            taxType: { $first: "$taxType" },
                            quantity: { $sum: "$products.quantity" },
                            subtotal: { $sum: { $multiply: ["$products.total", "$products.quantity"] } }
                        }
                    },
                    {
                        $addFields: {
                          taxTypeId: {
                            $cond: {
                              if: { $ne: ["$taxType", ""] },
                              then: { $toObjectId: "$taxType" },
                              else: "$taxType"
                            }
                          },
                          providerId: {
                            $cond: {
                              if: { $ne: ["$provider", ""] },
                              then: { $toObjectId: "$provider" },
                              else: "$provider"
                            }
                          }
                        }
                    },
                    {
                        $lookup: {
                          from: "providers",
                          localField: "providerId",
                          foreignField: "_id",
                          as: "providerData"
                        }
                    },
                    {
                        $lookup: {
                          from: "companies",
                          localField: "taxTypeId",
                          foreignField: "taxes.id",
                          as: "taxInfo"
                        }
                    },
                    { $unwind: { path: "$providerData", preserveNullAndEmptyArrays: true } },
                    { $unwind: { path: "$taxInfo", preserveNullAndEmptyArrays: true } },
                    {
                        $addFields: {
                            paidAmount: {
                                $reduce: {
                                    input: "$payments",
                                    initialValue: 0,
                                    in: { $add: ["$$value", "$$this.amount"] }
                                }
                            },
                            taxRate: {
                                $cond: {
                                if: {
                                    $and: [
                                    { $eq: ["$taxInfo", null] },
                                    { $eq: ["$taxType", ""] }
                                    ]
                                },
                                then: 0,
                                else: {
                                    $let: {
                                        vars: {
                                            taxObj: {
                                                $arrayElemAt: [
                                                {
                                                    $filter: {
                                                    input: "$taxInfo.taxes",
                                                    as: "tax",
                                                    cond: { $eq: ["$$tax.id", "$taxTypeId"] } // Aquí especifica el nombre del impuesto a aplicar
                                                    }
                                                },
                                                0 
                                            ]}
                                        },
                                        in: "$$taxObj.rate"
                                    }
                                }
                            }
                          }
                        }
                    },
                    {
                        $addFields: {
                            taxAmount: {
                                $cond: {
                                    if: {
                                        $or: [
                                            { $eq: ["$taxType", null] },
                                            { $eq: ["$taxType", ""] }
                                        ]
                                    },
                                    then: 0,
                                    else: { $multiply: [{ $subtract: ["$subtotal", "$discount"] },  { $divide: ["$taxRate", 100] } ] }
                                }
                            },
                        }
                    },
                    {
                        $addFields: { total: { $add: [{ $subtract: ["$subtotal", "$discount"] }, '$shipping', '$taxAmount'] } }
                    },
                    filterBy,
                    { $sort: { _id: -1 } },
                    { $skip: currentPage },
                    { $limit: itemsPerPage },
                    searchProvider
                ]).toArray()

                mongoClient.close()
                return resolve({ status: true, purchases })
            } catch (error) {
                console.error('[getPurchases] -> ', error)
                return reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }
        })
    }

    static getPurchase ({ companyId, purchaseNumber, fields })
    {
        return new Promise (async (resolve, reject) => {
            try {
                const { db, mongoClient } = await initDbConnection()
                const purchase = await db.collection('purchases').find({ companyId, purchaseNumber }).project( fields ).toArray()

                mongoClient.close()
                return resolve({ status: true, purchase: purchase.length > 0 ? purchase[0] : [] })
            } catch (error) {
                console.error('[getPurchase] -> ', error)
                return reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }
        })
    }

    static async addPayment ( { purchaseId, amount, paymentMethod, date, note, userId, taxList } ) {
        /** NO SE PUEDE PAGAR MAS DEL MONTO PENDIENTE A PAGAR. */
        const pendingAmount = await this.getPendingAmount({ purchaseId, taxList })

        if (parseFloat(amount) > pendingAmount) { 
            return { status: false, message: IResponseMessage.SALE.PAID_MORE_AMOUNT }
        }

        const _id = new ObjectID(purchaseId)
        const { db, mongoClient } = await initDbConnection()

        const data = {
            id: new ObjectID(),
            amount: parseFloat(amount),
            paymentMethod: paymentMethod,
            date,
            note,
            paidBy: userId,
            createdAt: Date.now()
        }
        
        const newPayment = await db.collection('purchases').updateOne(
            { _id },
            { $push: { payments: data } }
        )

        mongoClient.close()
        
        if (!!newPayment)
            return { status: true, message: IResponseMessage.SALE.PAY_SUCCESS }
        
        return { status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR }
    }

    static editPayment ( { purchaseId, paymentId, amount, paymentMethod, date, note, companyId } ) {
        return new Promise ( async (resolve, reject) => {
            try {
                const payment = {
                    amount: parseFloat(amount),
                    paymentMethod,
                    date,
                    note
                }

                /** HACER QUERY PARA EDITAR SOLO LOS KEYS QUE ESTAN EN EL OBJECT PAYMENTS */
                const updateQuery = {};
                for (const key in payment) {
                    updateQuery[`payments.$.${key}`] = payment[key];
                }

                const { db, mongoClient } = await initDbConnection()
                const response = await db.collection('purchases').updateOne(
                    { _id: purchaseId, companyId, "payments.id": paymentId },
                    { $set: updateQuery }
                );

                if (!response) return resolve({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })

                mongoClient.close()
                return resolve({ status: true, message: IResponseMessage.SALE.PAY_SUCCESS })
            } catch (error) {
                console.error('[editPayment] -> ', error)
                return reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }
        })
    }

    /** DELETE PAYMENT OF SALE
     * @param {object} data
	 * @param {ObjectID} data.paymentId Id of payment
	 * @param {int} data.saleNumber Number of sale
	 * @param {string} data.companyId Id of company
     * @returns Object
    */
     static async deletePayment({ paymentId, purchaseNumber, companyId })
     {
         return new Promise ( async (resolve, reject) => {
             try {
                 const { db, mongoClient } = await initDbConnection();
                 const response = await db.collection('purchases').updateOne( 
                     { purchaseNumber, companyId },
                     { $pull: { payments: { id: paymentId } } 
                 })
 
                 if (!response) return resolve({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
                 
                 mongoClient.close()
                 return resolve({ status: true, message: IResponseMessage.SALE.PAYMENT_DELETED })
             } catch (error) {
                 console.error('[deletePayment] ->', error);
                 return reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR });
             }
         })
     }

    static async getAmountPaid (purchaseId, payments = []) {
        /*------------------------------------------------------------
        NOTA: SI LE PASAS EL ID DE LA VENTA BUSCA LOS DATOS EN LA DB, 
        PERO SI LE PASAS LOS PAGOS HACE LOS CALCULOS SIN BUSCAR EN LA DB
        ------------------------------------------------------------*/
        let paymentAmount = 0
        let purchasePayments = payments

        if (purchaseId) {
            const _id = new ObjectID(purchaseId)
            const { db, mongoClient } = await initDbConnection();
            
            purchasePayments = await db.collection('purchases').find({ _id }).project({ payments : 1 }).toArray()
            purchasePayments = purchasePayments[0]['payments']
            mongoClient.close()
        }
        
        if (purchasePayments.length <= 0) {
            return 0
        }

        purchasePayments.forEach( payment => paymentAmount += parseFloat(payment.amount));

        return paymentAmount
    }

    static async getPendingAmount ({ purchaseId, taxList }) {
        /** OBTENER MONTOS TOTALES DE LA COMPRA */
        const _id = new ObjectID(purchaseId)
        const { db, mongoClient } = await initDbConnection()

        const result = await db.collection('purchases').find({ _id }).project({ taxType: 1, discount: 1, shipping: 1, products : 1 }).toArray()
        const purchase = result[0]
        mongoClient.close() 

        const purchaseAmounts = Purchase.getPurchaseAmounts( purchase.products )
        const subTotal = ( purchaseAmounts.subTotal - purchase.discount )
        purchase.taxes = 0

        if (purchase.taxType) {
            purchase.taxes = Inventory.calculateTaxes({
                taxType: purchase.taxType,
                price: subTotal,
                taxList
            })
        }

        const totalAmount = (subTotal + purchase.shipping + purchase.taxes)

        /** OTENER MONTO PAGADO DE LA COMPRA */
        const amountPaid = await this.getAmountPaid(purchaseId)
        
        return this.formatAmount( (totalAmount - parseFloat(amountPaid)) ) // MONTO PENDIENTE => monto total de la venta - monto pagado
    }

    

    static getPurchaseAmounts ( products )
    {
        let quantity = 0
        let subTotal = 0

        products?.forEach( product => {
            quantity += parseFloat(product.quantity)
            subTotal += ( parseFloat(product.total) * parseFloat(product.quantity) )
        })
        
        return {
            quantity,
            subTotal
        }
    }

    static async GetPurchaseSequence (companyId) {
        const id = new ObjectID(companyId)
        const { db, mongoClient } = await initDbConnection();
        const purchaseSequence = await db.collection('companies').find({ _id: id }).project({ purchaseQuantity: 1 }).toArray();
        
        mongoClient.close()
        return purchaseSequence[0]['purchaseQuantity']
    }

    static async SetPurchaseSequence (companyId, lastSequence) {
        const id = new ObjectID(companyId); 

        const newSequence = parseInt(lastSequence) + 1
        const { db, mongoClient } = await initDbConnection();
        await db.collection('companies').updateOne({ _id: id }, { $set: { purchaseQuantity: newSequence } });

        mongoClient.close();
    }

    static setPurchaseStatus ( { pendingAmount, paidAmount } ) {
        /* NOTAS
            #1: ESTADO PAGADO
            #2: ESTADO PENDIENTE
            #3: A CREDITO (SIN PAGOS).
        */
        let pending = pendingAmount
        let paid = paidAmount

        if (pending <= 0) { 
            return 1
        }
        
        if (pending > 0 && paid > 0) {
            return 2
        }

        if (paid === 0) {
            return 3
        }
    }

    static setStatusName ( { statusId } ) {
        if ( statusId == 1 ) {
            return IResponseMessage.SALE.SALE_STATUS_PAID
        }

        if ( statusId == 2 ) {
            return IResponseMessage.SALE.SALE_STATUS_PENDING
        }

        if ( statusId == 3 ) {
            return IResponseMessage.SALE.SALE_STATUS_ANY_PAY
        }
    }

    static findPurchasesByFilter ( { companyId, filter = [] } )
    {
        return new Promise ( async (resolve, reject) => {
            try {
                /** FILTRAR POR EMPRESA */
                filter.unshift({ $match: { companyId } }) 

                const { db, mongoClient } = await initDbConnection()
                const purchases = await db.collection('purchases').aggregate( filter ).toArray();

                mongoClient.close()
                return resolve({ status: true, purchases })
            } catch (error) {
                console.error('[findPurchasesByFilter] -> ', error)
                return reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }
        }) 
    }

    static formatAmount (amount)
    {
        const number = amount.toLocaleString('en-US', { style: 'decimal', minimumFractionDigits : 2 })
        return parseFloat(number.replace(/,/g, '').replace(/\./, '.'))
    }

    /** GET PURCHASE TOTAL AMOUNT
     * @param {object} data
	 * @param {Array} data.products 
	 * @param {double} data.discount 
	 * @param {double} data.shipping 
	 * @param {string} data.taxType 
	 * @param {Array} data.taxList 
     * @returns Int
    */
    static getPurchaseAmount ({ products, discount, shipping, taxType, taxList }) {
        let subTotal = 0

        products.forEach( product => subTotal += (parseFloat(product.total) * parseFloat(product.quantity)) )

        subTotal = ( subTotal - discount )
        
        let taxes = 0

        if (taxType) {
            taxes = Inventory.calculateTaxes({
                taxType: taxType,
                price: subTotal,
                taxList
            })
        }

        return  (subTotal + shipping + taxes)
    }
}

module.exports = Purchase