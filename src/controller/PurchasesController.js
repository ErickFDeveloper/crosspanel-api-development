const IResponseMessage = require('../interfaces/ResponseMessage');
const Token = require('../utils/token');
const dayjs = require('dayjs');
const Purchase = require('../models/Purchase')
const Inventory = require('../models/Inventory');
const Company = require('../models/Company');
const User = require('../models/User');
const Provider = require('../models/Provider');
const { ObjectId } = require('mongodb');

require('dayjs-ext');

class PurchasesController
{
    static async getPurchaseStats (req, res)
    {
        try {
            const { search } = { ...req.body }
            const token = Token.getData(req)

            /** BUSCAR TODAS LAS COMPRAS */
            const response = await Purchase.getPurchaseStats({
                companyId: token.companyId,
                search,
            })


            /** CATEGORIZAR LAS COMPRAS */
            let paid = 0
            let pending = 0
            let onCredit = 0
            let all = 0

            if (response.status) {
                const purchases = response.purchases
                const taxList = await Company.getTaxList( token.companyId )

                all = purchases.length

                purchases.forEach( purchase => {
                    /** MONTOS DE LA COMPRA */
                    const purchaseAmounts = Purchase.getPurchaseAmounts( purchase.products )
                        
                    let subTotal = ( purchaseAmounts.subTotal - purchase.discount )

                    let taxes = 0
                    if (purchase.taxType) {
                        taxes = Inventory.calculateTaxes({
                            taxType: purchase.taxType,
                            price: subTotal,
                            taxList
                        })
                    }

                    const total = subTotal + purchase.shipping + taxes

                    /** MONTOS DE PAGO */
                    let paidAmount = 0
                    purchase.payments.forEach( payment => {
                        paidAmount += parseFloat(payment.amount)
                    }) 

                    /** SELECCIONAR ESTADO DE LA COMPRA */
                    const purchaseStatus = Purchase.setPurchaseStatus({
                        pendingAmount: (total - paidAmount),
                        paidAmount
                    })

                    if (purchaseStatus === 1) {
                        paid++
                    }

                    if (purchaseStatus === 2) {
                        pending++
                    }
                    
                    if (purchaseStatus === 3) {
                        onCredit++
                    }
                })
                
            }
            
            res.json({ status: true, paid, pending, onCredit, all })
        } catch (error) {
            console.error('[getSalesStats] -> ', error)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }

    static async savePurchase (req, res)
    {
        try {
            const token = Token.getData(req)
            const { provider, establishment, date, products, paymentMethod, payAmount, taxType, amountInfo, comprobanteFiscal, previousProducts, purchaseNumber } = { ...req.body }

            const formatedProducts = products ? JSON.parse(products) : []
            const formatedAmounts = amountInfo ? JSON.parse(amountInfo) : null

            if (!provider) {
                return res.json({ status: false, message: IResponseMessage.PURCHASE.PROVIDER_REQUIRED })
            }

            if (!establishment) {
                return res.json({ status: false, message: IResponseMessage.PURCHASE.ESTABLISHMENT_REQUIRED })
            }

            if (formatedProducts.length < 1) {
                return res.json({ status: false, message: IResponseMessage.PURCHASE.PROVIDER_REQUIRED })
            }

            if (!formatedAmounts) {
                return res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }

            let newDate = dayjs(date).format('YYYY-MM-DD')
            
            if (!date) {
                newDate =  dayjs().format('YYYY-MM-DD')
            }

            const purchase = {
                provider,
                establishment,
                date: dayjs(newDate).valueOf(),
                products: formatedProducts,
                taxType,
                payments: [],
                discount: formatedAmounts.discount,
                shipping: formatedAmounts.shipping,
                comprobanteFiscal,
                companyId: token.companyId,
                createdBy: token.userId
            }

            /** ELIMINAR KEYS QUE NO SE DEBEN SUBIR CUANDO SE EDITA UNA COMPRA */
            if (purchaseNumber) {
                delete purchase.establishment
                delete purchase.payments
                delete purchase.companyId
                delete purchase.createdBy
            }

            const response = await Purchase.savePurchase({
                purchase,
                purchaseNumber: parseInt(purchaseNumber),
                companyId: token.companyId
            })

            /** SI SE REGISTRA LA COMPRA LE APLICAMOS PAGOS Y AUMENTAMOS LE INVENTARIO */
            if (response.status) {
                formatedProducts.forEach( (product, index) => {
                    formatedProducts[index].reajust = true
                })

                if (!purchaseNumber) {
                    /** CUANDO SE CREA UNA COMPRA... */
                    await Inventory.updateProductQuantity({
                        products: formatedProducts,
                        establishment
                    })
                    
                    if (payAmount && paymentMethod) {
                        const taxList = await Company.getTaxList( token.companyId )

                        await Purchase.addPayment({
                            purchaseId: response.purchaseId,
                            amount: parseFloat(payAmount),
                            paymentMethod,
                            date: dayjs(newDate).valueOf(),
                            note: '',
                            userId: token.userId,
                            taxList
                        })
                    }

                    /** GUARDAR NOTA */
                    await helper.saveNote({
                        note: `Un usuario ha creado la compra #${response.purchaseNumber}`,
                        type: 'purchase',
                        typeAction: 'create',
                        referenceId: response.purchaseNumber.toString(),
                        userId: token.userId,
                        companyId: token.companyId
                    })
                } else {
                    const previousProductsF = JSON.parse(previousProducts)

                    previousProductsF.forEach( (product, index) => {
                        previousProductsF[index].type = 'purchase'
                    })

                    /** CUANDO SE EDITA UNA COMPRA... */
                    await Inventory.updateProductQuantity({
                        products: formatedProducts,
                        establishment,
                        previousProducts: previousProductsF
                    })

                    /** GUARDAR NOTA */
                    await helper.saveNote({
                        note: `Un usuario ha editado la compra #${purchaseNumber}`,
                        type: 'purchase',
                        typeAction: 'edit',
                        referenceId: purchaseNumber.toString(),
                        userId: token.userId,
                        companyId: token.companyId
                    })
                }
            }

            res.json(response)
        } catch (error) {
            console.error('[savePurchase] -> ', error)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }

    static async deletePurchase (req, res)
    {
        try {
            const { purchaseNumber } = { ...req.body }
            const token = Token.getData(req)

            if (!purchaseNumber) {
                return res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }

            /** BUSCAR PRODUCTOS DE LA COMPRA */
            const purchaseResponse = await Purchase.getPurchase({
                companyId: token.companyId,
                purchaseNumber: parseInt(purchaseNumber),
                fields: {
                    establishment: 1,
                    products: 1
                }
            })

            const purchase = purchaseResponse.status ? purchaseResponse.purchase : []

            /** ELIMINAR COMPRA */
            const response = await Purchase.deletePurchase({
                purchaseNumber: parseInt(purchaseNumber),
                companyId: token.companyId
            })

            /** AJUSTAR EL INVENTARIO */
            if (response.status) {
                await Inventory.updateProductQuantity({
                    products: purchase.products,
                    establishment: purchase.establishment
                })
            }
           
            res.json(response)
        } catch (error) {
            console.error('[deletePurchase] -> ', error)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }

    static async getPurchases (req, res)
    {
        try {
            const { search, filterBy, currentPage, itemsPerPage } = { ...req.body }
            const token = Token.getData(req)

            let filter = {
                paid: {
                    $match: {
                        $expr: { $gte: ["$paidAmount", "$total"] }
                    }
                },
                pending: {
                    $match: {
                        $expr: {
                            $and: [ { $gt: ["$paidAmount", 0] }, { $lt: ["$paidAmount", "$total"] } ]
                        }
                    }
                },
                onCredit: { 
                    $match: {
                        payments: []
                    } 
                },
                all: { $match: {} }
            }

            const response = await Purchase.getPurchases({ companyId: token.companyId, search, filterBy: filter[filterBy], currentPage: helper.getPaginationCurrentPage(currentPage, itemsPerPage), itemsPerPage })

            if (response.status)
            {
                const purchases = response.purchases

                /** SELECCIONAR ESTADO DE LA COMPRA */
                for ( const [index, purchase] of Object.entries(purchases) ) {
                    purchases[index].status = Purchase.setPurchaseStatus({
                        pendingAmount: (purchases[index].total - purchase.paidAmount),
                        paidAmount: purchase.paidAmount
                    })

                    purchases[index].statusName = Purchase.setStatusName({ statusId: purchase.status })
                }
            }

            res.json(response)
        } catch (error) {
            console.error('[getPurchases] -> ', error)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }

    static async getPurchase (req, res)
    {
        try {
            const { purchaseNumber } = { ...req.body }
            const token = Token.getData(req)

            if (!purchaseNumber)
            {
                return res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }

            const purchaseResponse = await Purchase.getPurchase({
                companyId: token.companyId,
                purchaseNumber: parseInt(purchaseNumber)
            })

            let purchase = Array()

            /** BUSCAR MAS DATOS DE LA COMPRA */
            if (purchaseResponse.status) {
                dayjs.locale('es')

                purchase = purchaseResponse.purchase

                purchase.stringDate = dayjs(purchase.date).format('dddd, D [de] MMMM [de] YYYY')

                /** DATOS DEL PROVEDOR */
                const responseProvider = await Provider.getProviderById({
                    providerId: purchase.provider,
                    fields: {
                        name: 1
                    }
                })

                purchase.providerData = responseProvider.status ? responseProvider.provider : []
                purchase.date = dayjs(purchase.date).format('YYYY-MM-DD')

                /** DATOS DEL ALMACEN */
                const responseEstablishment = await Company.getEstablishmentById({
                    companyId: token.companyId,
                    establishmentId: purchase.establishment
                })

                purchase.establishmentData = responseEstablishment.status ? responseEstablishment.establishment : []

                /** MONTOS DE LA COMPRA */
                const purchaseAmounts = Purchase.getPurchaseAmounts( purchase.products )
                    
                purchase.quantity = purchaseAmounts.quantity
                purchase.subTotal = purchaseAmounts.subTotal

                const subTotal = ( purchaseAmounts.subTotal - purchase.discount )
                const taxList = await Company.getTaxList( token.companyId )

                purchase.taxes = 0
                if (purchase.taxType) {
                    purchase.taxes = Inventory.calculateTaxes({
                        taxType: purchase.taxType,
                        price: subTotal,
                        taxList
                    })
                }

                purchase.total = subTotal + purchase.shipping + purchase.taxes

                /** SELECCIONAR TIPO DE IMPUESTO */
                taxList.forEach( tax => {
                    if (tax.id.toString() == purchase.taxType)
                        purchase.taxData = tax
                })

                /** MONTOS DE PAGO */
                purchase.paidAmount = 0
                purchase.payments.forEach( payment => {
                    purchase.paidAmount += parseFloat(payment.amount)
                }) 

                /** SELECCIONAR ESTADO DE LA COMPRA */
                purchase.status = Purchase.setPurchaseStatus({
                    pendingAmount: (purchase.total - purchase.paidAmount),
                    paidAmount: purchase.paidAmount
                })

                purchase.statusName = Purchase.setStatusName({ statusId: purchase.status })

                /** FORMATEAR DATOS DE LOS PAGOS */
                let paymentMethods = await Company.getPaymentMethods({ companyId: token.companyId })
                paymentMethods = paymentMethods.status ? paymentMethods.paymentMethods : {}

                for (const [index, payment] of Object.entries(purchase.payments)) {
                    purchase.payments[index].date = dayjs(payment.date).format('YYYY-MM-DD')
                    
                    const method = paymentMethods.find( method => method._id.toString() === payment.paymentMethod )
                    purchase.payments[index].paymentMethodName = method?.name

                    /** BUSCAR NOMBRE DE LA PERSONA QUE REALIZO EL PAGO */
                    const userData = await User.findById({ 
                        userId: payment.paidBy, 
                        fields: { name: 1 } 
                    })

                    purchase.payments[index].userName = userData.status ? userData.user?.name : {}
                }
            }

            res.json({
                status: true,
                purchase
            })
        } catch (error) {
            console.error('[getPurchase] -> ', error)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }

    static async getAddPaymentView (req, res)
    {
        try {
            const { purchaseNumber, isEditing } = { ...req.body }
            const token = Token.getData(req)

            if (!purchaseNumber && !isEditing) {
                return res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }

            const paymentMethods = await Company.getPaymentMethods({ companyId: token.companyId })

            if (isEditing) {
                return res.json({ status: true, paymentMethods: paymentMethods?.paymentMethods })
            }

            /** BUSCAR ID DE LA COMPRA */
            const purchaseResponse = await Purchase.getPurchase({ 
                companyId: token.companyId, 
                purchaseNumber: parseInt(purchaseNumber),
                fields: {
                    _id: 1
                }
            })
            
            if (!purchaseResponse.status) {
                return res.json(purchaseResponse)
            }

            const purchase = purchaseResponse.purchase
            const taxList = await Company.getTaxList(token.companyId)

            /** OBTENER MONTO PENDIENTE */

            const pendingAmount = await Purchase.getPendingAmount({
                purchaseId: purchase._id,
                taxList
            })

            /** OBTENER MONTO PAGADO */
            const amountPaid = await Purchase.getAmountPaid(purchase._id)


            res.json({
                status: true,
                pendingAmount,
                amountPaid,
                paymentMethods: paymentMethods.status ? paymentMethods.paymentMethods : []
            })
        } catch (error) {
            console.error('[getAddPaymentView] -> ', error)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }

    static async savePayment (req, res)
    {
        try {
            const { amount, method, date, note, purchaseNumber, paymentId, isEditing } = { ...req.body }
            const token = Token.getData(req)

            if (!purchaseNumber) {
                return res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }

            /** BUSCAR ID DE LA COMPRA */
            const purchaseResponse = await Purchase.getPurchase({ 
                companyId: token.companyId, 
                purchaseNumber: parseInt(purchaseNumber),
                fields: {
                    _id: 1,
                    products: 1,
                    discount: 1,
                    shipping: 1,
                    taxType: 1
                }
            })
            
            if (!purchaseResponse.status) {
                return res.json(purchaseResponse)
            }

            const newDate = dayjs(date).format('YYYY-MM-DD')
            const purchase = purchaseResponse.purchase
            const taxList = await Company.getTaxList(token.companyId)

            const paymentData = {
                purchaseId: purchase._id,
                amount,
                paymentMethod: method,
                date: dayjs(newDate).valueOf(),
                note,
                userId: token.userId,
                taxList         
            }

            let response

            if (isEditing === 'true') {
                paymentData.paymentId = new ObjectId(paymentId)
                paymentData.companyId = token.companyId

                /** VALIDAR QUE NO PAGE MAS DEL MONTO TOTAL DE LA COMPRA */
                const purchaseAmount = Purchase.getPurchaseAmount({
                    products: purchase.products,
                    discount: purchase.discount,
                    shipping: purchase.shipping,
                    taxType: purchase.taxType,
                    taxList
                })

                if (parseFloat(amount) > purchaseAmount) return res.json({ status: false, message: IResponseMessage.SALE.PAID_MORE_AMOUNT })

                response = await Purchase.editPayment(paymentData)
            } else {
                response = await Purchase.addPayment(paymentData);
            }

            res.json(response)
        } catch (error) {
            console.error('[savePayment] -> ', error)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }

    static async getPayments (req, res)
    {
        try {
            const { purchaseNumber } = req.query
            const companyId = Token.getData(req).companyId

            const response = await Purchase.getPurchase({
                companyId,
                purchaseNumber: parseInt(purchaseNumber), 
                fields: {
                    payments: 1
                }
            })

            if (!response.status) {
                return res.json(response)
            }
            
            const payments = response.purchase.payments

            /**
             * [OBTENER EXTRAS PARA MOSTAR PAGOS]
            */
            let paymentMethods = await Company.getPaymentMethods({ companyId })
            paymentMethods = paymentMethods.status ? paymentMethods.paymentMethods : []

            for (const [index, payment] of Object.entries(payments) ) {
                payments[index].paymentMethodName = paymentMethods.find( element => element._id.toString() === payment.paymentMethod )?.name
                payments[index].date = dayjs(payment.date).format('YYYY-MM-DD')

                /** BUSCAR NOMBRE DE LA PERSONA QUE REALIZO EL PAGO */
                const userData = await User.findById({ 
                    userId: payment.paidBy, 
                    fields: { name: 1 } 
                })

                payments[index].userName = userData.status ? userData.user?.name : {}
            }

            res.json({
                status: response.status,
                payments
            })
        } catch (error) {
            console.error('[getPayments] -> ', error)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }

    static async deletePayment (req, res)
    {
        try {
            const { paymentId, purchaseNumber } = req.query
            const companyId = Token.getData(req).companyId

            const response = await Purchase.deletePayment({
                paymentId: new ObjectId(paymentId),
                purchaseNumber: parseInt(purchaseNumber),
                companyId
            })

            res.json(response)
        } catch (error) {
            console.error('[deletePayment] -> ', error)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }
}

module.exports = PurchasesController