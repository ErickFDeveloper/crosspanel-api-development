const initDbConnection = require('../config/db');
const IResponseMessage = require('../interfaces/ResponseMessage');
const { ObjectID } = require('bson');
const dayjs = require('dayjs');
require('dayjs/locale/es')

class Provider {
    static saveProvider ( { provider, providerNumber, companyId } ) {
        return new Promise( async (resolve, reject) => {
            try {
                const { db, mongoClient } = await initDbConnection()

                /** SAVE EXISTING PROVIDER */ 
                if (providerNumber) {
                    const editProvider = await db.collection('providers').updateOne({ providerNumber, companyId }, { $set: { ...provider } });

                    if (!editProvider) {
                        return resolve({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
                    }
                } else { 
                    /** SAVE A NEW PROVIDER */
                    providerNumber = await this.getProviderSequence(provider.companyId)
                    provider.providerNumber = providerNumber

                    const newProvider = await db.collection('providers').insertOne({ ...provider })

                    if (!newProvider) {
                        return resolve({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
                    }

                    await this.setProviderSequence(provider.companyId, providerNumber)
                }
                
                mongoClient.close()
                return resolve({ status: true, message: IResponseMessage.PROVIDER.PROVIDER_SAVED, providerNumber })
            } catch (error) {
                console.error('[saveProvider in model -> ]' + error)
                return reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }
        })
    }

    static deleteProvider ({ companyId, providerNumber }) {
        return new Promise( async (resolve, reject) => {
            try {
                const { db, mongoClient } = await initDbConnection();
                await db.collection('providers').deleteOne({ companyId, providerNumber });

                mongoClient.close();
                return resolve({ status: true, message: IResponseMessage.PROVIDER.PROVIDER_DELETED })
            } catch (error) {
                console.error('[deleteProvider] -> ', error)
                return reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }
        })
    }

    /**
     * @param { object } data
     * @param { string } data.companyId Id of company
     * @param { int } data.providerNumber Provider number
     * @param { object } data.fields Data to show
    */
    static getProvider ({ companyId, providerNumber, providerId, fields }) {
        return new Promise ( async (resolve, reject) => {
            try {
                const filter = { companyId }

                if (providerNumber) {
                    filter.providerNumber = providerNumber
                } else {
                    filter._id = new ObjectID(providerId)
                }

                const { db, mongoClient } = await initDbConnection();
                const provider = await db.collection('providers').find(filter).project(fields).toArray();

                if (!provider)
                {
                    return resolve({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR });
                }

                mongoClient.close();
                resolve({ status: true, provider: provider[0] });
            } catch (error) {
                console.error('[getProvider] -> ', error)
                return reject({status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR})
            }
        })
    }

    static getProviderById ( { providerId, fields } ) {
        return new Promise ( async (resolve, reject) => {
            try {
                const { db, mongoClient } = await initDbConnection();
                let provider = await db.collection('providers').find({ _id: new ObjectID(providerId) }).project(fields).toArray();
                provider = provider[0]

                mongoClient.close();
                resolve({ status: true, provider });
            } catch (error) {
                console.error('[getProviderById in model ->] ' + error)
                return reject({status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR})
            }
        })
    }

    static getTotalProviders (useInFind) {
        return new Promise ( async (resolve, reject) => {
            try {
                const { db, mongoClient } = await initDbConnection();
                await db.collection('providers').countDocuments(useInFind, (err, count) => {
                    if (err) return resolve(0)
                    
                    mongoClient.close()
                    return resolve(count)
                })
            } catch (error) {
                console.error('[getTotalProviders] in model -> ', error)
                return reject({status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR})
            }
        })
    }

    static getProviders ({ filter, currentPage, itemsPerPage }) {
        return new Promise ( async (resolve, reject) => {
            try {
                const { db, mongoClient } = await initDbConnection();
                const providers = await db.collection('providers').find(filter).skip(currentPage).limit(itemsPerPage).sort({ _id: -1 }).toArray();
                
                mongoClient.close();
                return resolve({ status: true, providers })
            } catch (error) {
                console.error('[getProviderList] ->' + error);
                return reject({ status: false, message : IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }
        })
    }

    static async getProviderSequence (companyId) {
        const _id = new ObjectID(companyId)
        const { db, mongoClient } = await initDbConnection();
        const providerSequence = await db.collection('companies').find({ _id }).project({ providerQuantity: 1 }).toArray();
        
        mongoClient.close()
        return providerSequence[0]['providerQuantity']
    }

    static async setProviderSequence (companyId, lastSequence) {
        const id = new ObjectID(companyId); 

        const newSequence = parseInt(lastSequence) + 1
        const { db, mongoClient } = await initDbConnection();
        await db.collection('companies').updateOne({ _id: id }, { $set: { providerQuantity: newSequence } });

        mongoClient.close();
    }
}
module.exports = Provider