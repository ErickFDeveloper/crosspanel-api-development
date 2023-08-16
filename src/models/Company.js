const { ObjectID } = require('bson');
const initDbConnection = require('../config/db');
const IResponseMessage = require('../interfaces/ResponseMessage');
class Company {

    /**
     * @param {object} company Data of company to create
    * */
    static async create(company) {
        const { db, mongoClient } = await initDbConnection()
        const companyCreated = await db.collection('companies').insertOne(company);
        mongoClient.close();

        if (!!companyCreated)
            return { status: true, insertedId: companyCreated.insertedId };

        return { status: false }
    }

    static async findById({ companyId, fields })
    {
        try {
            const { db, mongoClient } = await initDbConnection()
            const company = await db.collection('companies').find({ _id: companyId }).project(fields).toArray()
            mongoClient.close()

            if (!company) return false
            
            return company[0]
        } catch (error) {
            console.error('[findById] -> ', error)
            return false
        }
    }

    /** GET COMPANY GENERAL DATA
     * @param {string} companyId 
    * */
    static generalData ({ companyId, fields }) {
        return new Promise ( async (resolve, reject) => {
            try {
                const _id = new ObjectID(companyId)
                const { db, mongoClient } = await initDbConnection();
                const generalData = await db.collection('companies').find({ _id }).project(fields).toArray();

                mongoClient.close()
                return resolve({ status: true, data: generalData[0] })
            } catch (error) {
                console.error('[generalData] in Model -> ', error)
                return reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }
        })
    }

    static setCompanyData ({ data, companyId }) {
        return new Promise ( async (resolve, reject) => {
            try {
                const _id = new ObjectID(companyId);
                const { db, mongoClient } = await initDbConnection();
                await db.collection('companies').updateOne( { _id }, { 
                    $set: {...data} 
                })

                mongoClient.close()
                resolve({ status: true, message: IResponseMessage.SYSTEM.DATA_SAVED })
            } catch (error) {
                console.error('[setCompanyData] in Model -> ', error)
                return reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }
        })
    }

    static getPaymentMethods ({ companyId }) {
        return new Promise ( async (resolve, reject) => {
            try {
                const { db, mongoClient } = await initDbConnection()
                const paymentMethods = await db.collection('paymentMethods').find({
                    $or: [
                        { companyId: "0" },
                        { companyId }
                    ]
                }).toArray()

                mongoClient.close()
                return resolve({ status: true, paymentMethods })
            } catch (error) {
                console.error('[getPaymentMethods] -> ', error)
                return reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }
        })
    }

    static findPaymentMethodById ({ id, fields }) {
        return new Promise ( async (resolve, reject) => {
            try {
                const _id = new ObjectID(id)

                const { db, mongoClient } = await initDbConnection()
                const paymentMethod = await db.collection('paymentMethods').find({ _id }).project(fields).toArray()

                mongoClient.close()
                return resolve({ status: true, paymentMethod: paymentMethod[0] })
            } catch (error) {
                console.error('[findPaymentMethodById] -> ', error)
                return reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }
        })
    }

    static getCategories ({ companyId, fields })
    {
        return new Promise ( async (resolve, reject) => {
            try {
                const { db, mongoClient} = await initDbConnection()
                const categories = await db.collection('categories').find({ companyId }).project(fields).toArray()

                mongoClient.close()
                return resolve({ status: true, categories })
            } catch (error) {
                console.error('[] -> ', error)
                return reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }
        })
    }

    static findCategoryById ({ categoryId, fields })
    {
        return new Promise ( async (resolve, reject) => {
            try {
                const _id = new ObjectID(categoryId)
                const { db, mongoClient} = await initDbConnection()
                const category = await db.collection('categories').find({ _id }).project(fields).toArray()

                mongoClient.close()
                return resolve({ status: true, category: category[0] })
            } catch (error) {
                console.error('[findCategoryById] -> ', error)
                return reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }
        })
    }

    static async getTaxList (companyId) 
    {
        const _id = new ObjectID(companyId)
        const { db, mongoClient } = await initDbConnection()
        const taxes = await db.collection('companies').find( { _id } ).project({ taxes : 1 }).toArray()

        mongoClient.close()

        return taxes[0]['taxes'] !== undefined ? taxes[0]['taxes'] : []
    }

    static getEstablishments ({ companyId }) 
    {
        return new Promise( async (resolve, reject) => {
            try {
                const _id = new ObjectID(companyId)
                const { db, mongoClient } = await initDbConnection()
                const establishments = await db.collection('companies').find( { _id } ).project({ _id: 0, establishments: 1 }).toArray()

                mongoClient.close()
                console.log(establishments[0])
                return resolve({ status: true, establishments: establishments[0]['establishments'] })
            } catch (error) {
                console.error('[getEstablishments] -> ', error)
                return reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }
        })
    }

    static getEstablishmentById ({ companyId, establishmentId }) 
    {
        return new Promise( async (resolve, reject) => {
            try {
                const _id = new ObjectID(companyId)
                const { db, mongoClient } = await initDbConnection()
                const establishment = await db.collection('companies').find( { _id, 'establishments._id': new ObjectID(establishmentId) } ).project({ 'establishments.$': 1 }).toArray()

                mongoClient.close()
                return resolve({ status: true, establishment: (establishment[0] && establishment[0]['establishments'] ? establishment[0]['establishments'][0] : []) })
            } catch (error) {
                console.error('[getEstablishmentById] -> ', error)
                return reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }
        })
    }

    static saveEstablishment ({ companyId, establishment }) 
    {
        return new Promise( async (resolve, reject) => {
            try {
                const _id = new ObjectID(companyId)
                const { db, mongoClient } = await initDbConnection()

                let response
                const data = {
                    name: establishment.name,
                    note: establishment.note
                }

                if (establishment.establishmentId) {
                    const updateQuery = {};
                    for (const key in data) {
                        updateQuery[`establishments.$.${key}`] = data[key];
                    }

                    response = await db.collection('companies').updateOne(
                        { _id, "establishments._id": establishment.establishmentId },
                        { $set: updateQuery }
                    )
                } else {
                    data._id = establishment._id
                    response = await db.collection('companies').updateOne(
                        { _id },
                        { $push: { establishments: data } }
                    )
                }
               
                if (!response) return resolve({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
                
                mongoClient.close()
                return resolve({ status: true, message: IResponseMessage.SYSTEM.DATA_SAVED })
            } catch (error) {
                console.error('[saveEstablishment] -> ', error)
                return reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }
        })
    }

    static deleteEstablishment ({ companyId, establishmentId })
    {
        return new Promise( async (resolve, reject) => {
            try {
                const _id = new ObjectID(companyId)
                const { db, mongoClient } = await initDbConnection()

                const response = await db.collection('companies').updateOne( 
                    { _id },
                    { $pull: { establishments: { _id: establishmentId } } 
                })

                if (!response) return resolve({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
                
                mongoClient.close()
                return resolve({ status: true, message: IResponseMessage.SALE.PAYMENT_DELETED })
            } catch (error) {
                console.error('[deleteEstablishment] -> ', error)
                return reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }
        })
    }

    static getNotes ({ companyId, limit = 0 })
    {
        return new Promise( async (resolve, reject) => {
            try {
                const { db, mongoClient } = await initDbConnection()

                const notes = await db.collection('notes').find({ companyId }).limit(limit).sort({ _id: -1 }).toArray()

                if (!notes) return resolve({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
                
                mongoClient.close()
                return resolve({ status: true, notes })
            } catch (error) {
                console.error('[getNotes] -> ', error)
                return reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }
        })
    }

    static saveTax ({ companyId, tax }) 
    {
        return new Promise( async (resolve, reject) => {
            try {
                const _id = new ObjectID(companyId)
                const { db, mongoClient } = await initDbConnection()

                let response
                const data = {
                    name: tax.name,
                    rate: tax.rate
                }

                if (tax.id) {
                    const updateQuery = {};
                    for (const key in data) {
                        updateQuery[`taxes.$.${key}`] = data[key];
                    }

                    response = await db.collection('companies').updateOne(
                        { _id, "taxes.id": tax.id },
                        { $set: updateQuery }
                    )
                } else {
                    data.id = tax._id
                    response = await db.collection('companies').updateOne(
                        { _id },
                        { $push: { taxes: data } }
                    )
                }
               
                if (!response) return resolve({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
                
                mongoClient.close()
                return resolve({ status: true, message: IResponseMessage.SYSTEM.DATA_SAVED })
            } catch (error) {
                console.error('[saveTax] -> ', error)
                return reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }
        })
    }

    static deleteTax ({ companyId, taxId })
    {
        return new Promise( async (resolve, reject) => {
            try {
                const _id = new ObjectID(companyId)
                const { db, mongoClient } = await initDbConnection()

                const response = await db.collection('companies').updateOne( 
                    { _id },
                    { $pull: { taxes: { id: taxId } } 
                })

                if (!response) return resolve({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
                
                mongoClient.close()
                return resolve({ status: true, message: IResponseMessage.SALE.PAYMENT_DELETED })
            } catch (error) {
                console.error('[deleteTax] -> ', error)
                return reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }
        })
    }

    static async findUnitById( unitId )
    {
        try {
            const { db, mongoClient } = await initDbConnection()
            const unit = await db.collection('units').find({ _id: new ObjectID(unitId) }).toArray()
            mongoClient.close()

            return unit.length > 0 ? unit[0] : {}
        } catch (error) {
            console.error('[findUnitById] -> ', error)
            return {}
        }
    } 
}

module.exports = Company