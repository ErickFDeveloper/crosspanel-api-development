const initDbConnection = require('../config/db');
const IResponseMessage = require('../interfaces/ResponseMessage');
const { ObjectID } = require('bson');
const dayjs = require('dayjs');
require('dayjs/locale/es')

class Client {
    static getClientsQuantity ({ companyId })
    {
        return new Promise ( async (resolve, reject) => {
            try {
                const { db, mongoClient } = await initDbConnection()
                const clients = await db.collection('clients').count({ companyId })

                mongoClient.close()
                return resolve(clients)
            } catch (error) {
                console.error('[getClientsQuantity] -> ', error)
                return reject(0)
            }
        })
    }

    static SaveClient ( client ) {
        return new Promise( async (resolve, reject) => {
            try {
                const { db, mongoClient } = await initDbConnection()

                let clientNumber = 0
                
                if (client.clientNumber) { // SAVE EXISTING CUSTOMER
                    clientNumber = parseInt(client.clientNumber)

                    // ELIMINAR KEYS IMPORTANTES PARA QUE NO LOS ACTUALICE
                    delete client.createdAt
                    delete client.clientNumber
                    delete client.createdBy

                    await db.collection('clients').updateOne({ clientNumber, companyId: client.companyId }, { $set: { ...client } });
                } else { // SAVE A NEW CUSTOMER
                    clientNumber = await this.GetClientSequence(client.companyId)
                    client.clientNumber = clientNumber

                    await db.collection('clients').insertOne({...client})
                    await this.SetClientSequence(client.companyId, clientNumber)
                }
                
                mongoClient.close()
                return resolve({ status: true, message: (client.saveNote ? IResponseMessage.SYSTEM.NOTE_SAVED : IResponseMessage.CLIENT.CREATED_CLIENT), clientNumber })
            } catch (error) {
                console.error('[SaveClient in model -> ]' + error)
                return reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }
        })
    }

    static DeleteClient ( clientNumber, companyId ) {
        return new Promise( async (resolve, reject) => {
            try {
                const { db, mongoClient } = await initDbConnection();
                await db.collection('clients').deleteOne({ clientNumber: parseInt(clientNumber), companyId });

                mongoClient.close();
                return resolve({ status: true, message: IResponseMessage.CLIENT.CLIENT_DELETED })
            } catch (error) {
                console.error('[DeleteClient in model -> ]' + error)
                return reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }
        })
    }

    static findClient (name, companyId) {
        return new Promise( async (resolve, reject) => {
            try {
                name = new RegExp(name, 'i')

                const { db, mongoClient } = await initDbConnection()
                const clients = await db.collection('clients').find({
                    companyId,
                    $or: [
                        {firstName: {$regex: name}},
                        {lastName: {$regex: name}}
                    ]}).project({ firstName: 1, lastName: 1 }).toArray()

                const clientsFormated = []
                clients.forEach( client => {
                    let newObject = {
                        _id: client._id,
                        name: client.firstName + ' ' + client.lastName
                    }

                    clientsFormated.push(newObject)
                })

                mongoClient.close()

                return resolve({status: true, clients: clientsFormated})
            } catch (error) {
                console.error('[findClient in model ->] ' + error)
                return reject({status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR})
            }
        })
    }

    static GetClient (companyId, clientId) {
        return new Promise ( async (resolve, reject) => {
            try {
                dayjs.locale('es')

                const { db, mongoClient } = await initDbConnection();
                let client = await db.collection('clients').find({ companyId, clientNumber: clientId }).toArray();
                client = client[0]

                if (client?.birthDate) {
                    client.birthDate = dayjs(client.birthDate).format('YYYY-MM-DD')
                    client.stringDate = dayjs(client.birthDate).format('dddd, D [de] MMMM [de] YYYY')
                }

                mongoClient.close();
                resolve({ status: true, client: client });
            } catch (error) {
                console.error('[GetClient in model ->] ' + error)
                return reject({status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR})
            }
        })
    }

    static GetClientById (clientId, fields) {
        return new Promise ( async (resolve, reject) => {
            try {
                dayjs.locale('es')

                const { db, mongoClient } = await initDbConnection();
                let client = await db.collection('clients').find({ _id: new ObjectID(clientId) }).project(fields).toArray();
                client = client[0]

                if (client?.birthDate) {
                    client.birthDate = dayjs(client.birthDate).format('YYYY-MM-DD')
                    client.stringDate = dayjs(client.birthDate).format('dddd, D [de] MMMM [de] YYYY')
                }

                mongoClient.close();
                resolve({ status: true, client: client });
            } catch (error) {
                console.error('[GetClientById in model ->] ' + error)
                return reject({status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR})
            }
        })
    }

    static GetClientList (companyId, search, currentPage, itemsPerPage) {
        return new Promise ( async (resolve, reject) => {
            try {
                let useInFind = { companyId };
                
                if (search !== '') {
                    const clientName = new RegExp(search, 'i')

                    useInFind = {
                        companyId,
                        $or: [
                            {firstName: {$regex: clientName}},
                            {lastName: {$regex: clientName}}
                        ]
                    }
                }

                const {db, mongoClient} = await initDbConnection();
                const clients = await db.collection('clients').find(useInFind).skip(currentPage).limit(itemsPerPage).sort({ _id: -1 }).toArray();
                
                for (const [index, client] of Object.entries(clients)) {
                    clients[index].gender = parseInt(client.gender) == 0 
                        ? IResponseMessage.CLIENT.MALE : IResponseMessage.CLIENT.FEMALE

                    // GET CLIENT PURCHASE
                    const clientPurchase = await db.collection('sales').find({ companyId, 'client._id': client._id }).toArray()
                    clients[index].purchases = clientPurchase.length 
                }
                
                mongoClient.close();
                resolve({ status: true, clients })
            } catch (error) {
                console.error('[GetClientList in model] ->' + error);
                return reject({ status: false, message : IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }
        })
    }

    static getTotalClients (companyId, search) {
        return new Promise ( async (resolve, reject) => {
            try {
                let useInFind = { companyId };
                
                if (search !== '') {
                    const clientName = new RegExp(search, 'i')

                    useInFind = {
                        companyId,
                        $or: [
                            {firstName: {$regex: clientName}},
                            {lastName: {$regex: clientName}}
                        ]
                    }
                }

                const { db, mongoClient } = await initDbConnection();
                await db.collection('clients').countDocuments(useInFind, (err, count) => {
                    if (err) return resolve(0)
                    
                    mongoClient.close()
                    return resolve(count)
                })
            } catch (error) {
                console.error('[GetClient in model ->] ' + error)
                return reject({status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR})
            }
        })
    }

    static async GetClientSequence (companyId) {
        const id = new ObjectID(companyId)
        const { db, mongoClient } = await initDbConnection();
        const saleSequence = await db.collection('companies').find({ _id: id }).project({ clientQuantity: 1 }).toArray();
        
        mongoClient.close()
        return saleSequence[0]['clientQuantity']
    }

    static async SetClientSequence (companyId, lastSequence) {
        const id = new ObjectID(companyId); 

        const newSequence = parseInt(lastSequence) + 1
        const { db, mongoClient } = await initDbConnection();
        await db.collection('companies').updateOne({ _id: id }, { $set: { clientQuantity: newSequence } });

        mongoClient.close();
    }
}
module.exports = Client