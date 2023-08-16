const IResponseMessage = require('../interfaces/ResponseMessage');
const Inventory = require('../models/Inventory');
const Sale = require('../models/Sale');
const Company = require('../models/Company');
const User = require('../models/User');
const Client = require('../models/Client');
const Token = require('../utils/token');
const dayjs = require('dayjs');
const transporter = require('../utils/correo');
const { ObjectId } = require('mongodb');
require('dayjs/locale/es')

class SalesController
{	
    static async getSalesData (req, res) {
        try {
            const token = Token.getData(req)
            const taxes = await Inventory.getTaxList(token.companyId)
            const establishments = await Inventory.getEstablishmentList(token.companyId)
            const comprobantes = await Inventory.findComprobantes(token.companyId)
            const paymentMethods = await Company.getPaymentMethods(token.companyId)

            res.json({ status: true, taxes, establishments, comprobantes: comprobantes?.comprobantes, paymentMethods: paymentMethods.paymentMethods })
        } catch (error) {
            console.error(error)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }

    static async SaveSale (req, res)
    {  
        try {
            const token = Token.getData(req)
            const { client, date, isUnknowClient, products, previousProducts, paymentMethod, payAmount, taxType, province, municipality, sector, establishment, address, amountInfo, saleNumber, comprobanteFiscal, oldComprobante } = {...req.body}

            const allProducts = JSON.parse(products)
            const amounts = JSON.parse(amountInfo)
            const allPreviousProducts = previousProducts ? JSON.parse(previousProducts) : []
            const comprobanteData = comprobanteFiscal ? JSON.parse(comprobanteFiscal) : null
            const oldComprobanteData = oldComprobante ? JSON.parse(oldComprobante) : null

            /** VALIDAR OPCION DE CLIENTES ANONIMOS */
            const canMakeUnknownSales = await helper.checkPermission({ companyId: token.companyId, field: 'unknownSales' })

            if ( isUnknowClient === 'true' && !canMakeUnknownSales ) return res.json({ status: false, message: IResponseMessage.SALE.SALE_NEED_CLIENT })

            /** VALIDAR OPCION GUARDAR VENTAS SIN PAGOS */
            const canMakeCreditSales = await helper.checkPermission({ companyId: token.companyId, field: 'creditSales' })

            if ( !payAmount && !canMakeCreditSales ) return res.json({ status: false, message: IResponseMessage.SALE.SALE_NEED_PAY })
            
            if (isUnknowClient === 'false' && (client === '' || client.length < 1 || client === 'null')) {
                return res.json({ status: false, message: IResponseMessage.SALE.CLIENT_IS_EMPTY })
            }

            if (allProducts.length < 1) {
                return res.json({ status: false, message: IResponseMessage.SALE.THE_SALE_NEED_PRODUCTS })
            }

            if ( paymentMethod !== '' && ( payAmount === '' || parseFloat(payAmount) <= 0) ) {
                return res.json({ status: false, message: IResponseMessage.SALE.ADD_AMOUNT_TO_PAY })
            }

            if ( paymentMethod !== '' && ( parseFloat(payAmount) > parseFloat(amounts.total) )) {
                return res.json({ status: false, message: IResponseMessage.SALE.PAID_MORE_AMOUNT })
            }

            /**
             * [VALIDAR QUE LOS PRODUCTOS TIENEN CANTIDAD, SI LA OPCION DE SOBREVENTA ESTA DESABILITADA]
            */
            const canMakeOverSales = await helper.checkPermission({ companyId: token.companyId, field: 'oversale' })

            if (!canMakeOverSales) {
                for ( const [key, product] of Object.entries(allProducts)) {
                    const productQuantity = await Inventory.getProductQuantity({
                        companyId: token.companyId,
                        establishmentId: establishment,
                        productNumber: null,
                        productId: product._id
                    })

                    if (productQuantity <= 0) return res.json({ status: false, message: IResponseMessage.SALE.PRODUCT_WITHOUT_QUANTITY })
                }
            }
            


            // DELETE UNNECESSARY KEYS
            delete amounts.quantity
            delete amounts.taxes
            
            let newDate = dayjs(date).format('YYYY-MM-DD')
            
            if (!date) {
                newDate =  dayjs().format('YYYY-MM-DD')
            }
            
            const sale = {
                client,
                date: dayjs(newDate).valueOf(),
                isUnknowClient,
                products: allProducts,
                previousProducts: allPreviousProducts,
                paymentMethod,
                payAmount,
                taxType,
                province,
                municipality,
                sector,
                address,
                establishment,
                ...amounts,
                saleNumber,
                payments: [],
                companyId: token.companyId,
                createdBy: token.userId
            }

            /** SI SE ESTA EDITANDO, VALIDAR SI SE VA A CAMIBIAR EL COMPROBANTE POR UNA NUEVO*/
            let createComprobante = true

            if (saleNumber && oldComprobanteData?.firstNumber === comprobanteData?.firstNumber) {
                createComprobante = false
            }


            /** SI CREAS UNA FACTURA CON COMPROBANTE FISCAL, VALIDAMOS QUE YA NO ESTE USADO */
            let currentSecuence;

            if (createComprobante && comprobanteData !== null && comprobanteData._id) {
                currentSecuence = await Inventory.findComprobanteById(comprobanteData._id);

                if (parseInt(comprobanteData.firstNumber) < parseInt(currentSecuence.comprobante.firstNumber)) {
                    return res.json({ status: false, message: IResponseMessage.SALE.COMPROBANTE_USED })
                }

                /** GUARDAR COMPROBANTE */
                sale.comprobanteFiscal = {
                    _id: comprobanteData._id,
                    secuence: comprobanteData.firstNumber.toString()
                }
            } 

            /** EL USUARIO LE QUITO EL COMPROBANTE FISCAL A LA VENTA */
            if (comprobanteData !== null && comprobanteData._id === '') {
                sale.comprobanteFiscal = {}
            }

            const response = await Sale.SaveSale(sale)
            
            /** SI SE CREA LA VENTA, REALIZAMOS LAS SIGUIENTES ACCIONES */
            if (response.status) {

                /** SI TIENE COMPROBANTE FISCAL, CONFIGURAMOS LA SIGUIENTE SECUENCIA DEL COMPROBANTE FISCAL */
                if (createComprobante && comprobanteData !== null && comprobanteData._id) {
                    const newSecuence = {
                        _id: comprobanteData._id,
                        firstNumber: (parseInt(currentSecuence.comprobante.firstNumber) + 1).toString()
                    }

                    await Inventory.saveComprobante(newSecuence);
                }


                /**
                 * [GUARDAR NOTA]
                */
                if (saleNumber) {
                    await helper.saveNote({
                        note: `Un usuario ha editado la venta #${saleNumber}`,
                        type: 'sale',
                        typeAction: 'edit',
                        referenceId: ( typeof saleNumber === 'number' ? saleNumber.toString() : saleNumber ),
                        userId: token.userId,
                        companyId: token.companyId
                    })
                } else {
                    await helper.saveNote({
                        note: `Un usuario ha creado la venta #${response.saleId}`,
                        type: 'sale',
                        typeAction: 'create',
                        referenceId: response.saleId,
                        userId: token.userId,
                        companyId: token.companyId
                    })
                }
            }

            res.json(response)
        } catch (error) {
            console.error('[saveSale] -> ', error)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }

    static async DeleteSale (req, res)
    {
        try {
            const { saleNumber } = { ...req.body }
            const token = Token.getData(req)

            const companyId = token.companyId
            const userId = token.userId

            const response = await Sale.DeleteSale(saleNumber, companyId);

            if (response.status) {
                await helper.saveNote({
                    note: `Un usuario ha eliminado una venta!`,
                    type: 'sale',
                    typeAction: 'delete',
                    referenceId: '',
                    userId,
                    companyId
                })
            }
            res.json(response);
        } catch (error) {
            console.error('[DeleteSale in controller] ->' + error)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }

    static async getSaleStats (req, res)
    {
        try {
            const { search } = { ...req.body }
            const token = Token.getData(req)

            const response = await Sale.getSaleStats( token.companyId, search )

            res.json(response)
        } catch (error) {
            console.error('[getSalesStats in SalesController ->]', error)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }

    static async getSaleList (req, res)
    {
        try {
            const { search, filterBy, currentPage, itemsPerPage } = {...req.body}
            const token = Token.getData(req)

            let filter = {
                pagada: {
                    $match: {
                        $expr: { $gte: ["$paidAmount", "$total"] }
                    }
                },
                pendiente: {
                    $match: {
                        $expr: {
                            $and: [ { $gt: ["$paidAmount", 0] }, { $lt: ["$paidAmount", "$total"] } ]
                        }
                    }
                },
                credito: { 
                    $match: {
                        payments: []
                    } 
                },
                all: { $match: {} }
            }

            const response = await Sale.getSaleList( token.companyId, {
                search,
                filterBy: filter[filterBy],
            },
            {
                currentPage: helper.getPaginationCurrentPage(currentPage, itemsPerPage),
                itemsPerPage: itemsPerPage ? itemsPerPage : 0
            })

            if (response.status) {
                /** SET SALE STATUS */
                for ( const [key, sale] of Object.entries(response.sales) ) {
                    let pendingAmount = await Sale.getPendingAmount(null, { totalAmount: sale.total, paidAmount: sale.paidAmount })
                    let saleStatusId = await Sale.setSaleStatus({ saleId: null, pendingAmount, paidAmount: sale.paidAmount })
                    
                    response.sales[key].statusName = Sale.setStatusName( saleStatusId )
                    response.sales[key].statusId =  saleStatusId
                }
            }

            res.json(response)
        } catch (error) {
            console.error('[getSaleList] In Controller -> ' + error)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }

    static async GetSale (req, res) 
    {
        try {
            const { saleNumber, getInvoiceData } = {...req.body}
            const companyId = Token.getData(req).companyId

            const response = await Sale.getSale({ saleNumber, companyId })

            if (!response.status) {
                return res.json(response)
            }

            const sale = response.sale;
            const taxList = await Company.getTaxList(companyId);

            /**
             * [OBTENER DATOS NECESARIOS PARA MOSTRAR VENTA]
            */

            /** ESTABLISHMENT DATA */ 
            let establishmentData = await Company.getEstablishmentById({ companyId, establishmentId: sale.establishment })
            sale.establishmentData = establishmentData.status ? establishmentData.establishment : []


            /** FORMAT DATE */ 
            if (sale.date) {
                sale.date = dayjs(sale.date).format('YYYY-MM-DD')
                sale.stringDate = dayjs(sale.date).format('dddd, D [de] MMMM [de] YYYY')
            }

            /** GET PAID AMOUNT */ 
            sale.paidAmount = await Sale.getAmountPaid(null, sale.payments)

            /** GET SELLER DATA */
            const sellerData = await User.findById({
                userId: sale.createdBy,
                fields: { 
                    name: 1,
                    lastName: 1,
                    email: 1
                }
            })

            sale.seller = sellerData?.status ?
                sellerData.user : null;

            /** GET SALE TAXES */ 
            sale.taxes = Sale.GetSaleTaxes({
                sale,
                taxList
            })

            /** SET SALE STATUS */ 
             let pendingAmount = await Sale.getPendingAmount(null, { totalAmount: sale.total, paidAmount: sale.paidAmount })
             let saleStatusId = await Sale.setSaleStatus({ 
                saleId: null, 
                pendingAmount,
                paidAmount: sale.paidAmount 
             })
             
             sale.statusName = Sale.setStatusName( saleStatusId )
             sale.statusId =  saleStatusId

            /** GET CLIENT DETAILS */ 
            const clientDetails = await Client.GetClientById(sale.client._id, {
                phone: 1,
                email: 1,
                address: 1
            })

            sale.clientDetails = clientDetails.status ? 
                clientDetails.client : []

            /** SI LA VENTA TIENE COMPROBANTE BUSCAMOS LOS DATOS */
            if (sale.comprobanteFiscal) {
                const comprobanteResponse = await Inventory.findComprobanteById(sale.comprobanteFiscal._id)
                const comprobante = comprobanteResponse.status ? 
                    comprobanteResponse.comprobante : null;

                if (comprobante) {
                    comprobante.firstNumber = sale.comprobanteFiscal.secuence
                    response.sale.comprobante = Inventory.formatComprobante(comprobante)
                    response.sale.comprobanteFiscal = comprobante
                }
            }

            /** SI LA VENTA TIENE PAGOS OBTENEMOS LOS DATOS DE CADA PAGO */
            if (sale.payments.length > 0) {
                for (const [index, payment] of Object.entries(sale.payments)) {
                    const paymentResponse = await Company.findPaymentMethodById({
                        id: payment.paymentMethod,
                        fields: { name: 1 }
                    })

                    if (paymentResponse.status) {
                        sale.payments[index].paymentMethodName = paymentResponse.paymentMethod.name
                    }

                    /** BUSCAR NOMBRE DE LA PERSONA QUE REALIZO EL PAGO */
                    const userData = await User.findById({ 
                        userId: payment.paidBy, 
                        fields: { name: 1 } 
                    })

                    sale.payments[index].userName = userData.status ? userData.user?.name : {}

                    /** FORMATEAR FECHA */
                    sale.payments[index].date = dayjs(payment.date).format('YYYY-MM-DD')
                }
            }

            /** OBTENER DATOS NECESARIOS PARA LA FACTURA */
            if (getInvoiceData) {
                const companyData = await Company.generalData({
                    companyId,
                    fields: {
                        name: 1,
                        address: 1,
                        phone: 1,
                        logotype: 1
                    }
                })
                
                if (companyData.status) {
                    sale.companyData = companyData.data
                }
            }

            /** OBTENER DATOS DE LA PROVINICA, MUNICIPIO, SECTOR */
            const provices = await helper.getProvinces()
            const municipalities = await helper.getMunicipality({ provinceId: sale.province })
            const sectors = await helper.getSectors({ municipalityId: sale.municipality })

            response.sale.provinceName = provices.find( province => province._id.toString() === sale.province)?.name
            response.sale.municipalityName = municipalities.find( municipality => municipality._id.toString() === sale.municipality)?.name
            response.sale.sectorName = sectors.find( sector => sector._id.toString() === sale.sector)?.name

            res.json(response)
        } catch (error) {
            console.error('[GetSale] In Controller -> ' + error)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }

    static async savePayment (req, res)
    {
        try {
            const { saleId, amount, method, date, note, saleNumber, paymentId, isEditing } = { ...req.body }
            const token = Token.getData(req)

            if (!saleId) {
                return res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }

            if (!date) {
                return res.json({ status: false, message: IResponseMessage.EXPENSE.DATE_REQUIRED })
            }

            if (!amount) {
                return res.json({ status: false, message: IResponseMessage.SALE.REQUIRE_PAYMENT })
            }

            if (!method) {
                return res.json({ status: false, message: IResponseMessage.SALE.SELECT_PAYMENT_METHOD })
            }

            let newDate = dayjs(date).format('YYYY-MM-DD')
            
            if (!date) {
                newDate = dayjs().format('YYYY-MM-DD')
            }
            
            const paymentData = {
                amount,
                paymentMethod: method,
                date: dayjs(newDate).valueOf(),
                note,
                userId: token.userId
            }

            let response

            if (isEditing === 'true') {
                paymentData.saleNumber = parseInt(saleNumber)
                paymentData.paymentId = new ObjectId(paymentId)
                paymentData.companyId = token.companyId

                /** VALIDAR QUE EL MONTO NO SEA MAYOR AL MONTO DE LA VENTA */
                const sale = await Sale.getSale({ saleNumber: parseInt(saleNumber), companyId: token.companyId, fields: { total: 1 } })
                const total = sale.status ? sale.sale.total : 0

                if (parseFloat(amount) > parseFloat(total)) return res.json({ status: false, message: IResponseMessage.SALE.PAID_MORE_AMOUNT })

                response = await Sale.editPayment(paymentData)
            } else {
                paymentData.saleId = saleId
                response = await Sale.addPayment(paymentData);
            }

            res.json(response);
        } catch (error) {
            console.error('[savePayment] -> ', error)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }

    static async getSaleAmounts (req, res)
    {
        try {
            const { saleId, isEditing } = { ...req.body }
            const token = Token.getData(req)

            if (!saleId && !isEditing) {
                return res.json({ status: false, message: IResponseMessage.SALE.SALE_NO_FOUND })
            }

            const paymentMethods = await Company.getPaymentMethods({
                companyId: token.companyId
            })

            if (isEditing) {
                return res.json({ status: true, paymentMethods: paymentMethods?.paymentMethods })
            }

            const pendingAmount = await Sale.getPendingAmount(saleId)
            const paidAmount = await Sale.getAmountPaid(saleId)

            res.json({ status: true, pendingAmount, paidAmount, paymentMethods: paymentMethods?.paymentMethods  })
        } catch (error) {
            console.error('[getSaleAmounts] -> ', error)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }

    static async getPayments (req, res)
    {
        try {
            const { saleNumber } = req.query
            const companyId = Token.getData(req).companyId

            const response = await Sale.getSale({
                saleNumber: parseInt(saleNumber), 
                companyId,
                fields: {
                    payments: 1
                }
            })

            if (!response.status) {
                return res.json(response)
            }
            
            const payments = response.sale.payments

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
            const { paymentId, saleNumber } = req.query
            const companyId = Token.getData(req).companyId

            const response = await Sale.deletePayment({
                paymentId: new ObjectId(paymentId),
                saleNumber: parseInt(saleNumber),
                companyId
            })

            res.json(response)
        } catch (error) {
            console.error('[deletePayment] -> ', error)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }

    static async sendInvoice (req, res)
    {
        try {
            const { email } = req.body

            if (!email) return res.json({ status: false, message: IResponseMessage.SALE.NEED_EMAIL })

            const mailOptions = {
                from: 'contacto@crosspanel.com',
                to: email,
                subject: 'Factura generada',
                text: 'Factura pdf',
                attachments: [
                    {
                    filename: 'factura.pdf',
                    path: req.file.path
                    }
                ]
            };

            transporter.sendMail(mailOptions, (error) => {
                if (error) {
                  console.log('Error al enviar el correo electrónico:', error);

                  res.json({ status: false, message: 'Error al enviar el correo electrónico.' })
                }

                res.json({ status: true, message: IResponseMessage.SALE.INVOICE_SEND })
            });
        } catch (error) {
            console.error('[sendInvoice] -> ', error)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }
}

module.exports = SalesController;