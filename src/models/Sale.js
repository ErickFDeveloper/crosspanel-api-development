const { ObjectID } = require('bson');
const { MongoServerError } = require('mongodb');
const initDbConnection = require('../config/db');
const IResponseMessage = require('../interfaces/ResponseMessage');
const Inventory = require('./Inventory');

class Sales
{
    static SaveSale ( sale ) {
        return new Promise ( async (resolve, reject) => {
            try {
                let insertedSaleNumber;
                const paymentMethod = sale.paymentMethod
                delete sale.paymentMethod

                const { db, mongoClient } = await initDbConnection();

                if ( sale.isUnknowClient === 'false') {
                    const clientId = new ObjectID(sale.client)
                    const clientData = await db.collection('clients').find({ _id: clientId }).project({ firstName: 1, lastName: 1 }).toArray()
                    sale.client = clientData[0]
                } else {
                    sale.client = ""
                }

                if (sale.saleNumber) { //SE ESTA EDITANDO LA VENTA
                    const saleNumber = parseInt(sale.saleNumber)
                    const previousProducts = sale.previousProducts
                    const establishment = sale.establishment

                    // NO ACTUALIZAR ESTOS KEYS
                    delete sale.payments
                    delete sale.previousProducts
                    delete sale.saleNumber
                    delete sale.establishment
                    delete sale.createdBy

                    await db.collection('sales').updateOne({ saleNumber, companyId: sale.companyId }, { $set: { ...sale } }) 

                    Inventory.updateProductQuantity({
                        products: sale.products,
                        establishment: establishment,
                        previousProducts
                    })

                } else { //SE VA A CREAR UNA NUEVA VENTA
                    
                    // GET SALE SEQUENCE BEFORE CREATE
                    const saleSequence = await this.GetSaleSequence(sale.companyId)
                    sale.saleNumber = saleSequence
    
                    const newSale = await db.collection('sales').insertOne({ ...sale});

                    // UPDATE SALE SEQUENCE AFTER INSERT
                    this.SetSaleSequence(sale.companyId, saleSequence);
    
                    Inventory.updateProductQuantity({
                        products: sale.products,
                        establishment: sale.establishment
                    })

                    if (paymentMethod && paymentMethod !== '' && parseFloat(sale.payAmount) > 0) { // REALIZAR PAGO A LA VENTA
                        await this.addPayment({
                            saleId: newSale.insertedId,
                            amount: sale.payAmount,
                            paymentMethod: paymentMethod,
                            date: sale.date,
                            userId: sale.createdBy,
                        })
                    }

                    insertedSaleNumber = saleSequence;
                }

                mongoClient.close();
                return resolve({ status: true, message: IResponseMessage.SALE.SALE_SAVED, saleId: insertedSaleNumber });
            } catch (error) {
                console.error('[SaveSale in Model] ->' + error);
                if (error instanceof MongoServerError)
                {
                    return reject({ status: false, message: IResponseMessage.USER.FAILED_CREATING_USER });
                }

                return reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR });
            }
        })
    }

    static DeleteSale ( saleNumber, companyId ) {
        return new Promise ( async (resolve, reject) => {
            try {
                const { db, mongoClient } = await initDbConnection();
                
                // OBTENER PRODUCTOS DE LA VENTA PARA REAJUSTAR EL INVENTARIO
                const saleData = await db.collection('sales').find({ saleNumber: parseInt(saleNumber), companyId }).project({ products: 1, establishment: 1 }).toArray();
                const products = saleData[0]['products']
                const establishment = saleData[0]['establishment']

                products?.forEach( (product, index) => {
                    products[index].reajust = true
                })

                Inventory.updateProductQuantity({
                    products,
                    establishment
                })

                await db.collection('sales').deleteOne({ saleNumber: parseInt(saleNumber), companyId })
                mongoClient.close();

                resolve({ status: true, message: IResponseMessage.SALE.SALE_DELETED })
            } catch (error) {
                console.error('[DeleteSale in model] -> ' + error)
                return reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }
        })
    }

    static getSaleList ( companyId, {search, filterBy}, { currentPage, itemsPerPage } ) {
        return new Promise ( async (resolve, reject) => {
            try {
                let searchClient = {}
                if (search !== '') {
                    searchClient = {
                        $or: [
                        {'client.firstName': {$regex:  new RegExp(search, 'i') }},
                        {'client.lastName': {$regex:  new RegExp(search, 'i') }}
                    ]}
                }   

                const { db, mongoClient } = await initDbConnection();
                const sales = await db.collection('sales').aggregate([
                    {
                        $match: {
                            companyId,
                            ...searchClient
                        }
                    },
                    { $unwind: "$products" },
                    {
                        $group: {
                            _id: "$_id",
                            isUnknowClient: { $first: "$isUnknowClient" },
                            saleNumber: { $first: "$saleNumber" },
                            client: { $first: "$client" },
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
                          }
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
                                  if: { $eq: ["$taxType", ""] },
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
                    { $limit: itemsPerPage }
                ]).toArray()

                mongoClient.close()
                return resolve({status: true, sales })
            } catch (error) {
                console.error('[getSaleList] in model -> ', error)
                return reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }
        })
    }

    /** Get Sale by number
     * 
     * @param {int} saleNumber Company sale number
     * @param {ObjectID} companyId Company id
     * @returns Object
     */
    static getSale ({ saleNumber, companyId, fields })
    {
        return new Promise ( async (resolve, reject) => {
            try {
                const { db, mongoClient } = await initDbConnection();
                const sale = await db.collection('sales').find({ saleNumber, companyId }).project(fields).toArray()
  
                mongoClient.close();
                return resolve({ status: true, sale: sale ? sale[0] : {} });
            } catch (error) {
                console.error('[GetSale in Model] ->' + error);
                return reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR });
            }
        })
    }

    static async addPayment ( { saleId, amount, paymentMethod, date, note, userId } ) {
        const _id = new ObjectID(saleId)
        const { db, mongoClient } = await initDbConnection()
        const pendingAmount = await this.getPendingAmount(saleId, {})

        if (parseFloat(amount) > pendingAmount) { // NO SE PUEDE PAGAR MAS DEL MONTO PENDIENTE A PAGAR.
            return { status: false, message: IResponseMessage.SALE.PAID_MORE_AMOUNT }
        }

        const data = {
            id: new ObjectID(),
            amount: parseFloat(amount),
            paymentMethod: paymentMethod,
            date,
            note,
            paidBy: userId,
            createdAt: Date.now()
        }
        
        const newPayment = await db.collection('sales').updateOne(
            { _id },
            { $push: { payments: data } }
        )

        mongoClient.close()
        
        if (!!newPayment)
            return { status: true, message: IResponseMessage.SALE.PAY_SUCCESS }
        
        return { status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR }
    }

    static editPayment ( { saleNumber, paymentId, amount, paymentMethod, date, note, companyId } ) {
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
                const response = await db.collection('sales').updateOne(
                    { saleNumber, companyId, "payments.id": paymentId },
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
    static async deletePayment({ paymentId, saleNumber, companyId })
    {
        return new Promise ( async (resolve, reject) => {
            try {
                const { db, mongoClient } = await initDbConnection();
                const response = await db.collection('sales').updateOne( 
                    { saleNumber, companyId },
                    { $pull: { payments: { id: paymentId } } 
                })

                if (!response) return resolve({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
                
                mongoClient.close()
                return resolve({ status: true, message: IResponseMessage.SALE.PAYMENT_DELETED })
            } catch (error) {
                console.error('[GetSale in Model] ->' + error);
                return reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR });
            }
        })
    }

    static async getAmountPaid (saleId, payments = []) {
        /*------------------------------------------------------------
        NOTA: SI LE PASAS EL ID DE LA VENTA BUSCA LOS DATOS EN LA DB, 
        PERO SI LE PASAS LOS PAGOS HACE LOS CALCULOS SIN BUSCAR EN LA DB
        ------------------------------------------------------------*/
        let paymentAmount = 0
        let salesPayments = payments

        if (saleId !== null) {
            const _id = new ObjectID(saleId)
            const { db, mongoClient } = await initDbConnection();
            
            salesPayments = await db.collection('sales').find({ _id }).project({ payments : 1 }).toArray()
            salesPayments = salesPayments[0]['payments']
            mongoClient.close()
        }
        
        if (salesPayments.length <= 0) {
            return 0
        }

        salesPayments.forEach( payment => paymentAmount += parseFloat(payment.amount));

        return paymentAmount
    }

    static async getPendingAmount (saleId, { totalAmount, paidAmount } = '') {
        /*------------------------------------------------------------
       NOTA: SI LE PASAS EL ID DE LA VENTA BUSCA LOS DATOS EN LA DB, 
       PERO SI LE PASAS LOS PAGOS HACE LOS CALCULOS SIN BUSCAR EN LA DB
       ------------------------------------------------------------*/
        let saleAmount = totalAmount
        let salePaidAmout = paidAmount

        if (saleId !== null) {
            const _id = new ObjectID(saleId)
            const { db, mongoClient } = await initDbConnection()
    
            saleAmount = await db.collection('sales').find({ _id }).project({ total : 1 }).toArray()
            saleAmount = saleAmount[0]['total']

            salePaidAmout = await this.getAmountPaid(saleId)
            mongoClient.close() 
        }

        return this.formatAmount( (parseFloat(saleAmount) - parseFloat(salePaidAmout)) )  // MONTO PENDIENTE => monto total de la venta - monto pagado
    }

    static async setSaleStatus ({ saleId, pendingAmount, paidAmount }) {
        /* NOTAS
            1. SI LE PASAS UN saleID, LA FUNCION VA A BUSCAR LOS DATOS DESDE LA DB
            2. SI LE PASAS EL PENDING Y PAID AMOUNT, LA FUNCION UTILIZARA ESTOS VALORES PARA DETERMINAR EL ESTADO

            #1: ESTADO PAGADO
            #2: ESTADO PENDIENTE
            #3: A CREDITO (SIN PAGOS).
        */
        let pending = pendingAmount
        let paid = paidAmount

        if (saleId !== null) {
            pending = await this.getPendingAmount(saleId)
            paid = await this.getAmountPaid(saleId)
        } 
        
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

    static setStatusName ( statusId ) {
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

    static async getSaleStats ( companyId, filter ) {
        return new Promise ( async (resolve, reject) => {
            try {
                let saleFilter = {}

                if (filter) {
                    saleFilter = {
                        $or: [
                            {'client.firstName': {$regex:  new RegExp(filter, 'i') }},
                            {'client.lastName': {$regex:  new RegExp(filter, 'i') }}
                        ]
                    }
                }

                const { db, mongoClient } = await initDbConnection();
                const allSales = await db.collection('sales').find({ companyId, ...saleFilter }).project({ total: 1, payments: 1 }).toArray()
                
                mongoClient.close()

                let paid = 0
                let pending = 0
                let withoutPayments = 0
                
                for (const sale of allSales) {
                    let paidAmount = await this.getAmountPaid(null, sale.payments)
                    let pendingAmount = await this.getPendingAmount(null, { totalAmount: sale.total, paidAmount: paidAmount })
                    let saleStatus = await this.setSaleStatus({ saleId: null, pendingAmount, paidAmount })
                    
                    if (saleStatus == 1) {
                        paid++
                    }
                    
                    if (saleStatus == 2) {
                        pending++
                    }
                    
                    if (saleStatus == 3) {
                        withoutPayments++
                    }
                }

                return resolve({ status: true, paid, pending, withoutPayments, all: allSales.length })
            } catch ( error ) {
                console.error('getSalesStats in Model->' + error)
                return reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }
        })
    }

    static GetSaleTaxes ( {sale, taxList} ) {
        // FORMULA => ( (MONTO TOTAL DE LA VENTA - DESCUENTOS) * PORCENTAJE DE IMPUESTO ) / 100
        let saleTaxes = 0

        taxList.forEach ( tax => {
            if (sale.taxType === tax.id.toString()) {
                saleTaxes = ( (parseFloat(sale.subtotal) - parseFloat(sale.discount)) * tax.rate ) / 100
            }
        })

        return saleTaxes
    }

    static async GetSaleSequence (companyId) {
        const id = new ObjectID(companyId)
        const { db, mongoClient } = await initDbConnection();
        const saleSequence = await db.collection('companies').find({ _id: id }).project({ saleQuantity: 1 }).toArray();
        
        mongoClient.close()
        return saleSequence[0]['saleQuantity']
    }

    static async SetSaleSequence (companyId, lastSequence) {
        const id = new ObjectID(companyId); 

        const newSequence = parseInt(lastSequence) + 1
        const { db, mongoClient } = await initDbConnection();
        await db.collection('companies').updateOne({ _id: id }, { $set: { saleQuantity: newSequence } });

        mongoClient.close();
    }

    static async GetClientSales (clientId) {
        const { db, mongoClient } = await initDbConnection();
        const clientSales = await db.collection('sales').find({ "client._id": new ObjectID(clientId) }).limit(5).sort({ _id: -1 }).toArray();

        for ( const [key, sale] of  Object.entries(clientSales) ) {
             // CANTIDAD DE ARTICULOS QUE TIENE LA VENTA
             let productTotalQuantity = 0 
                    
             sale.products.forEach( element => productTotalQuantity += parseFloat(element.quantity)) 
             clientSales[key].quantity = productTotalQuantity

             // SELECCIONAR ESTADO DE LA VENTA
             let paidAmount = await this.getAmountPaid(null, sale.payments)
             let pendingAmount = await this.getPendingAmount(null, { totalAmount: sale.total, paidAmount: paidAmount })
             let saleStatusId = await this.setSaleStatus({ saleId: null, pendingAmount, paidAmount })
             
             clientSales[key].statusName = this.setStatusName( saleStatusId )
             clientSales[key].statusId =  saleStatusId
        }

        mongoClient.close();
        return clientSales;
    }

    static getSaleQuantity ({ companyId })
    {
        return new Promise ( async (resolve, reject) => {
            try {
                const { db, mongoClient } = await initDbConnection()
                const sales = await db.collection('sales').count({ companyId })

                mongoClient.close()
                return resolve(sales)
            } catch (error) {
                console.error('[getSaleQuantity] -> ', error)
                return reject(0)
            }
        })
    }

    static findSaleByDate ( { companyId, dateFrom, dateTo, fields })
    {
        return new Promise ( async(resolve, reject) => {
            try {
                const { db, mongoClient } = await initDbConnection()
                const sales = await db.collection('sales').find({
                    companyId,
                    $and: [
                        {date: { $gte: dateFrom }},
                        {date: { $lte: dateTo }}
                    ] 
                }).project(fields).toArray()

                mongoClient.close()

                return resolve({ status: true, sales })
            } catch (error) {
                console.error('[findSAleByDate] -> ', error)
                return reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }
        })
    }

    static findSalesByFilter ( { companyId, filter = [] } )
    {
        return new Promise ( async (resolve, reject) => {
            try {
                filter.unshift({ $match: { companyId } }) // FILTRAR POR EMPRESA

                const { db, mongoClient } = await initDbConnection()
                const sales = await db.collection('sales').aggregate( filter ).toArray();

                mongoClient.close()
                return resolve({ status: true, sales })
            } catch (error) {
                console.error('[findSalesByFilter] -> ', error)
                return reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }
        }) 
    }

    static formatAmount (amount)
    {
        const number = amount.toLocaleString('en-US', { style: 'decimal', minimumFractionDigits : 2 })
        return parseFloat(number.replace(/,/g, '').replace(/\./, '.'))
    }
}

module.exports = Sales