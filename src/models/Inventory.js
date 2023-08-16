const { ObjectID } = require('bson');
const { MongoServerError } = require('mongodb');
const initDbConnection = require('../config/db');
const IResponseMessage = require('../interfaces/ResponseMessage');
const dayjs = require('dayjs');

class Inventory
{
    static GetInventoryData (companyId) 
    {
        return new Promise ( async (resolve, reject) => {
            try {
                const { db, mongoClient } = await initDbConnection();
                const categories = await this.getCategoryList(companyId)
                const establishments = await this.getEstablishmentList(companyId)
                const units = await db.collection('units').find().toArray()
                const taxes = await this.getTaxList(companyId)
                mongoClient.close();

                return resolve({status: true, categories, establishments, units, taxes})
            } catch (error) {
                console.error(error);
                return reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR });
            }
        })
    }

    static getProductsQuantity ({ companyId })
    {
        return new Promise ( async (resolve, reject) => {
            try {
                const { db, mongoClient } = await initDbConnection()
                const products = await db.collection('products').count({ companyId })

                mongoClient.close()
                return resolve(products)
            } catch (error) {
                console.error('[getProductsQuantity] -> ', error)
                return reject(0)
            }
        })
    }

    static SaveProduct ( product ) 
    {
        return new Promise ( async (resolve, reject) => {
            try {
                const { db, mongoClient } = await initDbConnection();
                
                let productNumber = 0

                if ( product.productNumber ) { // EDITANDO PRODUCTO
                    delete product.createdAt

                    productNumber = parseInt(product.productNumber)
                    const companyId = product.companyId

                    delete product.companyId
                    delete product.productNumber

                    await db.collection('products').updateOne({ productNumber, companyId }, { $set: { ...product } })
                } else {
                    productNumber = await this.GetProductSequence(product.companyId)
                    product.productNumber = productNumber

                    await db.collection('products').insertOne({ ...product});
                    await this.SetProductSequence(product.companyId, productNumber)
                }
                
                mongoClient.close();
                return resolve({ status: true, message: IResponseMessage.PRODUCT.CREATED_PRODUCT, productNumber });
            } catch (error) {
                console.error(error);
                if (error instanceof MongoServerError)
                {
                    return reject({ status: false, message: IResponseMessage.USER.FAILED_CREATING_USER });
                }

                return reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR });
            }
        })
    }

    static DeleteProduct ( productNumber, companyId )
    {
        return new Promise ( async (resolve, reject) => {
            try {
                const { db, mongoClient } = await initDbConnection();
                await db.collection('products').deleteOne({ productNumber: parseInt(productNumber), companyId })

                mongoClient.close()
                return resolve({status: true, message: IResponseMessage.PRODUCT.PRODUCT_DELETED })
            } catch (error) {
                console.error(error);
                return reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR });
            }
        })
    }

    static GetProduct ( productNumber, companyId, getDetails = false )
    {
        return new Promise ( async (resolve, reject) => {
            try {
                const taxList = await this.getTaxList(companyId) // LISTA DE IMPUESTOS DE LA EMPRESA
                const { db, mongoClient } = await initDbConnection();
                let product = await db.collection('products').find({ productNumber, companyId }).toArray();
                product = product[0]

                if (getDetails) {
                    // GET PRODUCT CATEGORY DATA
                    const productCategory = await db.collection('categories').find({ _id: new ObjectID(product.category) }).toArray()
                    product.categoryData = productCategory[0] ? 
                        productCategory[0] : []


                    // GET PRODUCT UNIT DATA
                    const productUnit = await db.collection('units').find({ _id: new ObjectID(product.unit) }).toArray()
                    product.unitData = productUnit[0] ? 
                        productUnit[0] : []

                    // GET PRODUCT TAXES DATA
                    if (product.taxType != '0') {
                        const productTaxData = await db.collection('companies').find({ "taxes.id" : new ObjectID(product.taxType) }).project({ taxes: 1 }).toArray()
                        product.taxData = productTaxData[0] ?
                            productTaxData[0].taxes[0] : []
                    }

                    // CALC PRODUCT TAXES
                    product.taxAmount = this.calculateTaxes({
                        taxType: product.taxType, 
                        price: product.price, 
                        taxList
                    })

                    const establimentQuantity = await this.getEstablishmentList(companyId)

                    establimentQuantity.forEach( (establishment, index) => {
                        const establishmentIndex = product.establishments.findIndex( element => element.establishmentId == establishment._id)

                        if (establishmentIndex >= 0) {
                            establimentQuantity[index].quantity = parseFloat(product.establishments[establishmentIndex].quantity) 
                        } else {
                            establimentQuantity[index].quantity = 0
                        }
                    })

                    product.establishments = establimentQuantity

                    // GET SALES OF THE PRODUCT IN THIS MONTH
                    const date = new Date();
                    const firstMonthDay = new Date(date.getFullYear(), date.getMonth(), 1);
                    const lastMonthDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
                    
                    const productReport = await this.getProductInSale({
                        productId: product._id.toString(),
                        dateFrom: dayjs(firstMonthDay).valueOf(),
                        dateTo: dayjs(lastMonthDay).valueOf(),
                    })

                    product.report = productReport.status ?
                        productReport.products : []
                }
                
                mongoClient.close();
                return resolve({ status: true, product: product });
            } catch (error) {
                console.error('[Getproduct] -> ' + error);
                return reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR });
            }
        })
    }

    static getProductStats ( companyId, search ) 
    {
        return new Promise ( async (resolve, reject) => {
            try {
                const { db, mongoClient } = await initDbConnection();

                let filter = { companyId, type: 'product' }

                if (search !== '') {
                    filter.name = { $regex:  new RegExp(search, 'i') }
                }   

                const allProducts = await db.collection('products').find(filter).project({ taxType: 1, establishments: 1  }).toArray()

                let withQuantity = 0
                let withoutTaxes = 0
                let withoutQuantity = 0

                allProducts.forEach ( product => {
                    if (parseInt(product.taxType) == 0) {
                        withoutTaxes++
                    }

                    let haveQuantity = 0

                    product.establishments.forEach ( element => {
                        haveQuantity += parseFloat(element.quantity)
                    })

                    if (haveQuantity > 0) {
                        withQuantity++
                    }

                    if (haveQuantity <= 0) {
                        withoutQuantity++
                    }
                })

                await mongoClient.close()
                return resolve({ 
                    status: true, 
                    widthQuantity: withQuantity, 
                    widthoutQuantity: withoutQuantity, 
                    widthoutTaxes: withoutTaxes, 
                    allProducts: allProducts.length 
                })
            } catch (error) {
                console.error(error);
                return reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR });
            }
        }) 
    }

    static GetProducts ( { companyId, filterBy = [] } ) 
    {
        return new Promise ( async (resolve, reject) => {
            try {
                filterBy.push({ $match: { companyId } }) // FILTRAR POR EMPRESA

                const { db, mongoClient } = await initDbConnection();
                const taxList = await this.getTaxList(companyId) // LISTA DE IMPUESTOS DE LA EMPRESA
                let products = await db.collection('products').aggregate( filterBy ).toArray()

                products.forEach( (product, index) => { // CALCULAR IMPUESTOS DE CADA PRODUCTO
                    products[index].tax = this.calculateTaxes({
                        taxType: product.taxType, 
                        price: product.price, 
                        taxList
                    })
                });

                mongoClient.close()
                return resolve({status: true, products})
            } catch (error) {
                console.error(error);
                return reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR });
            }
        })
    }

    /** CALCULAR IMPUESTOS
     * @params { object } data 
     * @params { string } data.taxType 
     * @params { int } data.price 
     * @params { Array } data.taxList 
    */
    static calculateTaxes ( { taxType , price, taxList } ) 
    {
        let taxRate = 0;

        taxList.forEach ( tax => { // BUSCAR EL RATE EN LA LISTA DE IMPUESTOS.
            if (taxType == tax.id) {
                taxRate = tax.rate
            }
        })

        return (parseFloat(price) * parseFloat(taxRate)) / 100 // CALCULAR EL TAXRATE
    } 

    static async getTaxList (companyId) 
    {
        const _id = new ObjectID(companyId)
        const { db, mongoClient } = await initDbConnection()
        const taxes = await db.collection('companies').find( { _id } ).project({ taxes : 1 }).toArray()

        mongoClient.close()

        return taxes[0]['taxes'] !== undefined ? taxes[0]['taxes'] : []
    }

    static async getEstablishmentList (companyId) 
    {
        const _id = new ObjectID(companyId)
        const { db, mongoClient } = await initDbConnection()
        const establishments = await db.collection('companies').find( { _id } ).project({ establishments : 1 }).toArray()

        mongoClient.close()
        return establishments[0]['establishments'] !== undefined ? establishments[0]['establishments'] : []
    }

    static async getCategoryList (companyId) 
    {
        const { db, mongoClient } = await initDbConnection()
        const categories = await db.collection('categories').find( { companyId } ).toArray()

        mongoClient.close()

        return categories
    }

    static async updateProductQuantity ( { products, establishment, previousProducts } ) 
    {
        const { db } = await initDbConnection()

        previousProducts?.forEach ( product => { // UTILIZAR LA CANTIDADES ANTERIORES PARA CALCULAR QUE REAJUSTE SE LE DEBE HACER AL INVENTARIO

            if (product.productDeleted) {
                /** EL PRODUCTO SE ELIMINO DE LA LISTA */
                product.reajust = true

                product.quantity = product.type === 'purchase' ?
                    parseFloat(-product.quantity) : product.quantity

                products.push(product)
            } else {
                // SE AJUSTO LA CANTIDAD DEL PRODUCTO EN LA LISTA
                let newProduct = products.find( element => element._id === product._id )

                const newQuantity = product.type === 'purchase' ? 
                    parseFloat(newProduct.quantity) - parseFloat(product.quantity) :
                    parseFloat(product.quantity) - parseFloat(newProduct.quantity)

                newProduct = products.findIndex( element => element._id === product._id )
                products[newProduct].quantity = newQuantity       
                products[newProduct].reajust = true   
            }   
        })
        
        products.forEach ( async product => {
            const quantity = product.reajust ?
                product.quantity : parseFloat(-product.quantity)
            
            const _id = new ObjectID(product._id)
            await db.collection('products').updateOne(
                {_id: _id, 'establishments.establishmentId' : establishment },
                { $inc: { 'establishments.$.quantity': quantity } }
            )
        })
    }

    static async GetProductSequence (companyId) 
    {
        const id = new ObjectID(companyId)
        const { db } = await initDbConnection();
        const saleSequence = await db.collection('companies').find({ _id: id }).project({ productQuantity: 1 }).toArray();
        
        return saleSequence[0]['productQuantity']
    }

    static async SetProductSequence (companyId, lastSequence) 
    {
        const id = new ObjectID(companyId); 

        const newSequence = parseInt(lastSequence) + 1
        const { db } = await initDbConnection();
        await db.collection('companies').updateOne({ _id: id }, { $set: { productQuantity: newSequence } });
    }

    /** FIND PRODUCT IN SALES
     * 
     * @param {object} data
     * @param {string} data.productId 
     * @param {timestamp} data.dateFrom 
     * @param {timestamp} data.dateTo
     * @param {object} data.fields
     * @returns object
     */
    static getProductInSale ( { productId, dateFrom, dateTo } ) {
        return new Promise ( async (resolve, reject) => {
            try {
                console.log(dateFrom, dateTo)
                const { db, mongoClient } = await initDbConnection()
                const sales = await db.collection('sales').find({ 
                    'products._id': productId,
                    $and: [
                        {date: { $gte: dateFrom }},
                        {date: { $lte: dateTo }}
                    ] 
                }).project({ date: 1, products: 1 }).sort({ date: 1 }).toArray();

                mongoClient.close()

                const findProducts = []

                sales.forEach ( sale => {
                    sale.products.forEach( product => {
                        if (product._id === productId) {
                            product.date = dayjs(sale.date).format('YYYY/MM/DD')
                            findProducts.push(product)
                        }
                    })
                })

                resolve({ status: true, products: findProducts })
            } catch (error) {
                console.error('[findProductsByDate] -> ', error)
                return reject({ status: false, products: [] })
            }
        })
    }

    static saveComprobante ( comprobante ) {
        return new Promise ( async (resolve, reject) => {
            try {
                const { db, mongoClient } = await initDbConnection();

                if (!comprobante._id) { // NEW COMPROBANTE
                    await db.collection('comprobantes').insertOne(comprobante)
                } else { // EDIT COMPROBANTE
                    const _id = new ObjectID(comprobante._id)
                    delete comprobante._id
                    delete comprobante.companyId

                    await db.collection('comprobantes').updateOne({ _id }, {
                        $set: {...comprobante}
                    });
                }

                mongoClient.close()
                resolve({ status: true, message: IResponseMessage.SYSTEM.DATA_SAVED });
            } catch (error) {
                console.error('[saveComprobante] in model -> ', error)
                reject({ status: false, message: IResponseMessage.SYSTEM.UNEXPECTED_ERROR })
            }
        })
    }

    static findComprobantes ( companyId ) {
        return new Promise ( async (resolve, reject) => {
            try {
                const { db, mongoClient } = await initDbConnection();
                const comprobantes = await db.collection('comprobantes').find({
                    $or: [
                        {companyId: companyId},
                        {companyId: '0'}
                    ]
                }).sort({ _id: -1 }).toArray()

                mongoClient.close()
                resolve({ status: true, comprobantes });
            } catch (error) {
                console.error('[findComprobantes] in model -> ', error)
                reject({ status: false, message: IResponseMessage.SYSTEM.UNEXPECTED_ERROR })
            }
        })
    }

    static findComprobanteById (comprobanteId) {
        return new Promise ( async (resolve, reject) => {
            try { 
                const _id = new ObjectID(comprobanteId)
                const { db, mongoClient } = await initDbConnection()
                const comprobante = await db.collection('comprobantes').find({ _id }).toArray()

                mongoClient.close()
                resolve({ status: true, comprobante: comprobante[0] })
            } catch (error) {
                console.error('[findComprobanteById] -> in model ', error)
                reject({ status: false, message: IResponseMessage.SYSTEM.UNEXPECTED_ERROR })
            }
        })
    }

    static deleteComprobante (comprobanteId) {
        return new Promise ( async (resolve, reject) => {
            try { 
                const _id = new ObjectID(comprobanteId)
                const { db, mongoClient } = await initDbConnection()
                
                await db.collection('comprobantes').deleteOne({ _id });
                mongoClient.close()
                resolve({ status: true, message: IResponseMessage.SYSTEM.DELETED })
            } catch (error) {
                console.error('[findComprobanteById] -> in model ', error)
                reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }
        })
    }

    static formatComprobante (comprobante) {
        if ( !comprobante ) {
            return '000000000000';
        } 

        const comprobanteDigits = 8
        let comprobanteCeros = comprobanteDigits - comprobante.firstNumber.length;
        let comprobanteNumber = '';

        for (let i; comprobanteCeros > 0; i++) {
            comprobanteNumber += '0'
            comprobanteCeros--
        }

        return (comprobante.code + comprobanteNumber + comprobante.firstNumber);
    }

    static saveExpense (expense)
    {
        return new Promise ( async (resolve, reject) => {
            try {
                const { db, mongoClient } = await initDbConnection()
                const query = await db.collection('expenses').insertOne(expense)

                if (!query) 
                {
                    return resolve({ status: false, message: IResponseMessage.INVENTORY.UNEXPECTED_ERROR })
                }

                mongoClient.close()
                return resolve({ status: true, message: IResponseMessage.SYSTEM.DATA_SAVED })
            } catch (error){
                console.error('[saveExpense] -> ', error)
                return reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }
        })
    }

    static async getProductQuantity({ companyId, establishmentId, productNumber, productId })
    {
        try {
            let filter = new ObjectID()

            if (productNumber) filter.productNumber = parseInt(productNumber)

            if (productId) filter._id = new ObjectID(productId)

            if (!productNumber && !productId) return 0

            const { db, mongoClient } = await initDbConnection()
            const product = await db.collection('products').find({ companyId, 'establishments.establishmentId': establishmentId, ...filter }).project({ establishments: 1 }).toArray()

            mongoClient.close()

            if (!product) return 0

            console.log('PRODUCT -> ',  product[0]['establishments'])
            return product[0]['establishments'] ? product[0]['establishments'].find( element => element.establishmentId.toString() === establishmentId )?.quantity : 0
        } catch (error) {
            console.error('[getProductQuantity] -> ', error)
            return 0
        }
    }

    static saveService ( service ) 
    {
        return new Promise ( async (resolve, reject) => {
            try {
                let serviceId;
                const { db, mongoClient } = await initDbConnection();
                
                if ( service.serviceId ) { // EDITANDO SERVICIO
                    const companyId = service.companyId
                    
                    delete service.createdAt
                    delete service.companyId

                    await db.collection('products').updateOne({ _id: new ObjectID(service.serviceId), companyId }, { $set: { ...service } })
                } else {
                    const response = await db.collection('products').insertOne({ ...service });
                    serviceId = response.insertedId
                }
                
                mongoClient.close();
                return resolve({ status: true, message: IResponseMessage.PRODUCT.CREATED_PRODUCT, serviceId });
            } catch (error) {
                console.error('[saveService] in model -> ', error);
                return reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR });
            }
        })
    }

    static getService ({ serviceId, fields })
    {
        return new Promise ( async (resolve, reject) => {
            try {
                const { db, mongoClient } = await initDbConnection();
                const service = await db.collection('products').find({ _id: new ObjectID(serviceId) }).project(fields).toArray();
                    
                mongoClient.close();
                return resolve({ status: true, service: service.length > 0 ? service[0] : [] });
            } catch (error) {
                console.error('[getService] in model -> ' + error);
                return reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR });
            }
        })
    }

    
    static deleteService ({ serviceId })
    {
        return new Promise ( async (resolve, reject) => {
            try {
                const { db, mongoClient } = await initDbConnection();
                await db.collection('products').deleteOne({ _id: new ObjectID(serviceId) })

                mongoClient.close()
                return resolve({status: true, message: IResponseMessage.PRODUCT.PRODUCT_DELETED })
            } catch (error) {
                console.error(error);
                return reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR });
            }
        })
    }

    static existProductCode ({ companyId, code })
    {
        return new Promise ( async (resolve, reject) => {
            try {
                const { db, mongoClient } = await initDbConnection()
                const response = await db.collection('products').find({ companyId, code }).project({ _id: 1 }).toArray()
                mongoClient.close()

                if (!response) return resolve(false)

                return resolve( ( response.length > 0 ? true : false ) )
            } catch (error) {
                console.error('[existProductCode] -> ', error)
                return reject(false)
            }
        })
    }
}

module.exports = Inventory;