const { ObjectId } = require('mongodb');
const initDbConnection = require('../config/db');
const IResponseMessage = require('../interfaces/ResponseMessage');
const Company = require('../models/Company')
const dayjs = require('dayjs');

class helper {
    static formatNumber (number, decimal = 2) 
    {
        number = parseFloat(number)
        return number.toLocaleString('en-US', { style: 'decimal', minimumFractionDigits : decimal });
    }

    /** SAVE NOTE IN THE SYSTEM
     * @param {object} data
     * @param {string} data.note
     * @param {string} data.type 
     * @param {string} data.typeAction 
     * @param {string} data.referenceId 
    */
    static async saveNote ({ note, type, typeAction, referenceId, userId, companyId })
    {
        try {
            /** ORGANIZAR DATOS */
            const data = {
                note,
                type,
                typeAction,
                referenceId,
                userId,
                createdAt: dayjs().valueOf(),
                companyId
            }

            /** INSERTAR NOTA */
            const { db, mongoClient } = await initDbConnection()
            await db.collection('notes').insertOne(data);

            mongoClient.close()
        } catch (error) {
            console.error('[saveNote] in Helper -> ', error)
        }
    }

    static getProvinces ()
    {
        return new Promise (async (resolve, reject) => {
            try {
                const { db, mongoClient } = await initDbConnection()
                const provinces = await db.collection('provinces').find().toArray()

                if (!provinces)
                    return resolve(false)
                
                mongoClient.close()
                return resolve(provinces)
            } catch (error) {
                console.error('[getProvinces] -> ', error)
                return reject(false)
            }
        })
    }

    static getMunicipality ({ provinceId }) 
    {
        return new Promise ( async (resolve, reject) => {
            try {
                const filter = provinceId ? { provinceId } : null

                const { db, mongoClient } = await initDbConnection()
                const municipalities =  await db.collection('municipalities').find(filter).toArray()

                if (!municipalities)
                    return resolve(false)

                mongoClient.close()
                return resolve(municipalities)
            } catch (error) {
                console.error('[getMunicipality] -> ', error)
                return reject(false)
            }
        })
    }

    static getSectors ({ municipalityId }) 
    {
        return new Promise ( async (resolve, reject) => {
            try {
                const filter = municipalityId ? { municipalityId } : null

                const { db, mongoClient } = await initDbConnection()
                const sectors =  await db.collection('sectors').find(filter).toArray()

                if (!sectors)
                    return resolve(false)

                mongoClient.close()
                return resolve(sectors)
            } catch (error) {
                console.error('[getSectors] -> ', error)
                return reject(false)
            }
        })
    }

    static async checkPermission ({ companyId, field })
    {
        const project = new Object()
        project[field] = 1

        const { db, mongoClient } = await initDbConnection()
        const permission = await db.collection('companies').find({ _id: new ObjectId(companyId) }).project(project).toArray()

        mongoClient.close()

        if (!permission) return false
        
        return permission[0][field] === 1 || permission[0][field] === '1' ? true : false
    }

    static getPaginationCurrentPage (currentPage, itemsPerPage) {
        return currentPage & itemsPerPage ? (currentPage - 1) * itemsPerPage : 0
    }
}

module.exports = helper