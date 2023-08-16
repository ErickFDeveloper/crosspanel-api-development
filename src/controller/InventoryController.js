const IResponseMessage = require('../interfaces/ResponseMessage');
const Inventory = require('../models/Inventory');
const Provider = require('../models/Provider');
const Sale = require('../models/Sale');
const Company = require('../models/Company');
const Token = require('../utils/token');
const dayjs = require('dayjs')

class InventoryController
{	
    static async GetInventoryData (req,res)
    {
        try {
            const token = Token.getData(req)
            const response = await Inventory.GetInventoryData(token.companyId)
            res.json(response)
        } catch (error) {
            res.json({status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR})
        }
    }

    static async SaveProduct (req, res)
    {
        try {
            const { image, name, code, category, unit, cost, price, taxMethod, taxType, provider, establishments, oldProductCode, productNumber } = {...req.body}
            const token = Token.getData(req)
            const productEstablishments = JSON.parse(establishments)

            const product = {
                image,
                name,
                code, 
                category,
                unit,
                cost,
                price,
                taxMethod,
                taxType,
                provider,
                type: 'product',
                establishments: productEstablishments,
                companyId: token.companyId,
                createdAt: Date.now(),
                productNumber
            }

            if (name && code, category && unit && cost && price && taxMethod) {
                /** VALIDAR QUE EL CODIGO DEL PRODUCTO NO EXISTA */
                if ( (productNumber && oldProductCode !== code) || !oldProductCode ) {
                    const existCode = await Inventory.existProductCode({ companyId: token.companyId, code })

                    if (existCode) return res.json({ status: false, message: IResponseMessage.SALE.PRODUCT_EXIST })
                }
               

                const response = await Inventory.SaveProduct(product);

                if (response.status) {

                    /** 
                     * [GUARDAR NOTA]
                    */
                    if (productNumber) {
                        await helper.saveNote({
                            note: `Un usuario ha editado el producto #${productNumber}`,
                            type: 'product',
                            typeAction: 'edit',
                            referenceId: productNumber.toString(),
                            userId: token.userId,
                            companyId: token.companyId
                        })
                    } else {
                        await helper.saveNote({
                            note: `Un usuario ha registrado el producto #${response.productNumber}`,
                            type: 'product',
                            typeAction: 'create',
                            referenceId: response.productNumber.toString(),
                            userId: token.userId,
                            companyId: token.companyId
                        })
                    }
                }

                return res.json(response)
            }

            res.json({ status: false, message: IResponseMessage.SYSTEM.COMPLETE_ALL_FIELDS })
        }
        catch (error) {
            console.error('[SaveProduct] in controller ->' + error)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }

    static async saveService (req, res)
    {
        try {
            const { name, category, unit, price, taxMethod, taxType, serviceId } = {...req.body}
            const token = Token.getData(req)

            if (!name || !category || !unit || !price || !taxMethod) return res.json({ status: false, message: IResponseMessage.SYSTEM.COMPLETE_ALL_FIELDS })

            const service = {
                name,
                category,
                unit,
                price,
                taxMethod,
                taxType,
                type: 'service',
                companyId: token.companyId,
                createdAt: Date.now(),
                createdBy: token.userId
            }

            if (serviceId) service.serviceId = serviceId

            const response = await Inventory.saveService(service);

            if (response.status) {

                /** 
                 * [GUARDAR NOTA]
                */
                if (serviceId) {
                    await helper.saveNote({
                        note: `Un usuario ha editado el servicio ${name}`,
                        type: 'product',
                        typeAction: 'edit',
                        referenceId: serviceId,
                        userId: token.userId,
                        companyId: token.companyId
                    })
                } else {
                    await helper.saveNote({
                        note: `Un usuario ha registrado el servicio #${name}`,
                        type: 'product',
                        typeAction: 'create',
                        referenceId: response.serviceId.toString(),
                        userId: token.userId,
                        companyId: token.companyId
                    })
                }
            }

            return res.json(response)
        }
        catch (error) {
            console.error('[saveService] in controller ->', error)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }

    static async DeleteProduct (req, res)
    {
        try {
            const { productNumber } = { ...req.body }
            const companyId = Token.getData(req).companyId

            const response = await Inventory.DeleteProduct(productNumber, companyId)
            res.json(response)
        } catch (error) {
            console.error('[DeleteProduct] in controller ->' + error)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }

    static async GetProduct (req, res) 
    {
        try {
            const { productNumber, getDetails } = {...req.body}
            const token = Token.getData(req)

            if (!productNumber) {
                return res.json({ status: false, message: 'RESPONDER CON UN 404', show404: true })
            }

            const response = await Inventory.GetProduct(productNumber, token.companyId, getDetails);

            if (response.status) {
                const product = response.product

                if (product.provider && product.provider !== 'undefined') {
                    const providerData = await Provider.getProvider({
                        companyId: token.companyId,
                        providerNumber: null,
                        providerId: product.provider
                    })

                    response.product.providerData = providerData.status ? providerData.provider : {}
                }

            }

            res.json(response)
        }
        catch (error) {
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }

    static async SearchProduct (req, res) {
        try {
            const companyId = Token.getData(req).companyId
            const { productName, isPurchase, establishment } = {...req.body}

            if (establishment === undefined || establishment === '') {
                return res.json({ status: false, message: IResponseMessage.INVENTORY.NEED_ESTABLISHMENT })
            }

            const establishmentFilter = [
                {'establishments.establishmentId' : establishment},
                { establishments: { $exists: false } }
            ]

            /** EN LAS COMPRAS NO MOSTRAMOS LOS SERVICIOS */
            if (isPurchase) {
                establishmentFilter.pop()
            }

            const response = await Inventory.GetProducts({
                companyId,
                filterBy: [{ 
                    $match: { 
                        name: { $regex: new RegExp(productName, 'i') }, 
                        $or: [ ...establishmentFilter ]  
                    },
                }]
            })

            if (response.status) {
                const products = response.products

                products.forEach( (product, index) => {
                    if (product.type !== 'service') {
                        const quantity = product.establishments.find( Element => Element.establishmentId === establishment )?.quantity
                        response.products[index].productQuantity = quantity
                    }
                })
            }

            res.json(response)
        } catch (error) {
            console.error('[SearchProduct] -> ', error)
            res.json({status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR})
        }
    }

    static async getProductStats (req, res)
    {
        try {
            const { search } = { ...req.body }
            const token = Token.getData(req)
            const response = await Inventory.getProductStats( token.companyId, search )

            res.json(response)
        } catch (error) {
            console.error('[getProductStats]' + error)
            res.json({status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR})
        } 
    }

    static async getProductList (req, res) {
        try {
            const { productClassification, search, currentPage, itemsPerPage } = { ...req.body }
            const filterBy = []

            if (productClassification === 'widthQuantity') {
                filterBy.push({ $match: { quantity:{ $gt: 0 } } })
            }

            if (productClassification === 'widthoutTaxes') {
                filterBy.push({ $match: { taxType: "0" } })
            }

            if (productClassification === 'widthoutQuantity') {
                filterBy.push({ $match: { quantity:{ $lte: 0 } } })
            }

            if (search !== '') {
                filterBy.push({ $match: { name: { $regex: new RegExp(search, 'i') } } })
            }

            const token = Token.getData(req)
            const response = await Inventory.GetProducts({
                companyId: token.companyId,
                filterBy : [
                    { $match: { type: 'product' }},
                    { "$unwind": '$establishments' }, 
                    {
                        "$group": {
                            _id: "$_id",
                            name: { "$first": "$name"},
                            price: { "$first": "$price"},
                            code: { "$first": "$code"},
                            taxType: { "$first": "$taxType"},
                            type: { "$first": "$type"},
                            quantity: {"$sum": "$establishments.quantity"},
                            productNumber: { "$first": "$productNumber" },
                            createdAt: { "$first": "$createdAt" },
                            companyId: { "$first": "$companyId"}
                        }
                    },
                    { $sort: { _id: -1 } },
                    ...filterBy,
                    { $skip: helper.getPaginationCurrentPage(currentPage, itemsPerPage) },
                    { $limit: itemsPerPage }
                ]
            })

            res.json(response)
        } catch (error) {
            console.error('[getProductList] ->', error)
            res.json({status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR})
        }
    }

    static async getComprobante (req, res) {
        try {
            const { comprobanteId } = { ...req.body }

            if (!comprobanteId) {
                return res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }

            const response = await Inventory.findComprobanteById(comprobanteId);

            /** FORMAT TIMESTAP TO DATE */
            const expirationDate =  response.comprobante?.expirationDate
            response.comprobante.expirationDate =  expirationDate ?
                dayjs(expirationDate).format('YYYY-MM-DD') : 0;

            res.json(response)
        } catch(error) {
            console.error('[getComprobante] in controller -> ', error)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }

    static async deleteComprobante (req, res) {
        try {
            const { comprobanteId } = { ...req.body }

            if (!comprobanteId) {
                return res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }

            const response = await Inventory.deleteComprobante(comprobanteId);

            res.json(response)
        } catch(error) {
            console.error('[deleteComprobante] in controller -> ', error)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }

    static async getNextSecuence (req, res) {
        try {
            const { comprobanteType } = { ...req.body }

            /** BUSCAR LA SIGUIENTE SECUENCIA EN LA BASE DE DATOS */
            const result = await Inventory.findComprobanteById(comprobanteType);

            if (!result.status) {
                return res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }

            const comprobante = result.comprobante;

            /** FORMATEAR COMPROBANTE AL FORMATO ESTABLECIDO POR EL GOBIERNO */
            const comprobanteNumber = Inventory.formatComprobante(comprobante)

            /** VERIFICAR SI LA SECUENCIA ESTA DISPONIBLE */
            if (parseInt(comprobante.firstNumber) > parseInt(comprobante.lastNumber)) {
                return res.json({ status: false, message: IResponseMessage.INVENTORY.NOT_COMPROBANTE, comprobante: '00000000000' })
            }

            res.json({ status: true, comprobante: comprobanteNumber, comprobanteData: comprobante });
        } catch (error) {
            console.error('[getNextSecuence] in controller -> ', error)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }

    static async generalView (req, res)
    {
        try { 
            const date = new Date();
            const dateFrom = new Date(date.getFullYear(), date.getMonth(), 1); // FIRST DAY OF MOUNTH
            const dateTo = new Date(date.getFullYear(), date.getMonth() + 1, 0); // LAST DAY OF MOUNTH
            
            const { establishmentId } = { ...req.body }

            const token = Token.getData(req)
            const filters = Array()

            if(establishmentId) {
                filters.push({ $match: { 'establishments.establishmentId': establishmentId } })
            }

            const saleQuantity = await Sale.getSaleQuantity({ companyId: token.companyId })
            const response = await Inventory.GetProducts({
                companyId: token.companyId,
                filterBy : [
                    { $sort: { _id: -1 } },
                ],
                ...filters
            })

            /**
             * [CLASIFICAR PRODUCTOS POR SU CANTIDAD DE ARTICULOS EN STOCK]
            */
            let allProduct = 0
            let productWithQuantity = 0
            let productWithoutQuantity = 0

            let products = Array()

            if (response.status) {
                products = response.products

                products.forEach( product => {
                    const establishments = product.establishments

                    /** SI SE ESTA FILTRANDO POR ALMACEN, SOLO VERIFICAMOS LA CANTIDAD EN EL ALMACEN SELECCIONADO */
                    if (establishmentId) {
                        let selectedEstablishment = establishments.find( establishment => establishment.establishmentId === establishmentId )

                        selectedEstablishment.quantity > 0 ?
                            productWithQuantity++ : productWithoutQuantity++
                    } else {
                        let haveQuantity = false

                        establishments?.forEach( establishment => establishment.quantity > 0 ? (haveQuantity = true) : '')

                        haveQuantity ?
                            productWithQuantity++ : productWithoutQuantity++
                    }
                })
            }

            allProduct = products.length

            /**
             * [OBTENER PRODUCTOS MAS VENDIDOS]
            */
            let topSaleProducts = Array()
            const saleProducts = await Sale.findSalesByFilter({
                companyId: token.companyId,
                filter: [
                    {
                        $unwind: "$products"
                    },
                    {
                        $group: {
                            _id: "$products.name",
                            code: { "$first": "$products.code"},
                            totalQuantity: { $sum: "$products.quantity" }
                        }
                    },
                    {
                        $sort: { totalQuantity: -1 }
                    },
                    {
                        $limit: 5
                    }
                ]
            });


            if (saleProducts.status) {
                topSaleProducts = saleProducts.sales
            }

            /**
             * [OBETENER GRAFICO DE LAS VENTAS EN EL MES ACTUAL]
            */

            const saleResponse = await Sale.findSaleByDate({
                companyId: token.companyId,
                dateFrom: dayjs(dateFrom).valueOf(),
                dateTo: dayjs(dateTo).valueOf(),
                fields: {
                    date: 1,
                }
            });

            let salesChart = Array()

            if (saleResponse.status) {
                salesChart = saleResponse.sales
            }
            
            res.json({ status: true, productWithQuantity, productWithoutQuantity, allProduct, saleQuantity, salesChart, topSaleProducts })
        } catch (error) {
            console.error('[generalview] -> ', error)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }

    static async getServices (req, res) 
    {
        try {
            const { search, currentPage, itemsPerPage } = { ...req.body }
            const token = Token.getData(req)
            const filterBy = []

            if (search !== '') {
                filterBy.push({ $match: { name: { $regex: new RegExp(search, 'i') } } })
            }

            /**
             * [BUSCAR LA CANTIDAD TOTALES DE SERVICIOS]
            */
            const allServices = await Inventory.GetProducts({
                companyId: token.companyId,
                filterBy : [
                    { $match: { type: 'service' }},
                    { $sort: { _id: -1 } },
                    ...filterBy,
                ]
            })


            /**
             * [SERVICIOS PARA MOSTRAR]
            */
            const response = await Inventory.GetProducts({
                companyId: token.companyId,
                filterBy : [
                    { $match: { type: 'service' }},
                    { $sort: { _id: -1 } },
                    ...filterBy,
                    { $skip: helper.getPaginationCurrentPage(currentPage, itemsPerPage) },
                    { $limit: itemsPerPage }
                ]
            })

            if (response.status) {
                const services = response.products

                for ( const [key, service] of Object.entries(services) )
                {
                    const category = await Company.findCategoryById({ 
                        categoryId: service.category, fields: { name: 1 } 
                    })

                    response.products[key].categoryName = category.category?.name
                }
            }

            /** CONTCAR SERVICIOS */
            response.allServices = allServices.status ? allServices.products.length : 0

            res.json(response)
        } catch (error) {
            console.error('[getServices] ->', error)
            res.json({status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR})
        }
    }

    static async getService (req, res) 
    {
        try {
            const { serviceId } = { ...req.body }
            const companyId = Token.getData(req)?.companyId

            if (!serviceId) return res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })

            const response = await Inventory.getService({
                serviceId,
                fields: {
                    name: 1,
                    category: 1,
                    unit: 1,
                    price: 1,
                    taxMethod: 1,
                    taxType: 1,
                    type: 1,
                    createdAt: 1,
                    createdBy: 1
                }
            });

            if (response.status) {
                const service = response.service

                /** CALCULAR IMPUESTOS */
                const taxList = await Inventory.getTaxList(companyId)

                service.tax = Inventory.calculateTaxes({
                    taxType: service.taxType, 
                    price: service.price, 
                    taxList
                })

                /** CATEGORIA */
                const category = await Company.findCategoryById({ 
                    categoryId: service.category, fields: { name: 1 } 
                })

                service.categoryName = category.category?.name

                /** UNIT */
                service.unitName = await Company.findUnitById( service.unit )
                service.unitName = service.unitName?.name

                /** OBTENER LAS VECES QUE SE HA VENDIDO EL PRODUCTO */
                const date = new Date();
                const firstMonthDay = new Date(date.getFullYear(), date.getMonth(), 1);
                const lastMonthDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
                
                const productReport = await Inventory.getProductInSale({
                    productId: service._id.toString(),
                    dateFrom: dayjs(firstMonthDay).valueOf(),
                    dateTo: dayjs(lastMonthDay).valueOf(),
                })

                service.report = productReport.status ?
                    productReport.products : []
            }

            res.json(response)
        } catch (error) {
            console.error('[getService] -> ', error)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }

    static async deleteService (req, res)
    {
        try {
            const { serviceId } = { ...req.body }
            
            if (!serviceId) return res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })

            const response = await Inventory.deleteService({ serviceId })

            res.json(response)
        } catch (error) {
            console.error('[deleteService] in controller ->', error)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }

}

module.exports = InventoryController;