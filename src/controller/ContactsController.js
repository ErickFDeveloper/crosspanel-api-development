const IResponseMessage = require('../interfaces/ResponseMessage');
const Token = require('../utils/token');
const dayjs = require('dayjs');
const Client = require('../models/Client')
const Sale = require('../models/Sale')
const Provider = require('../models/Provider');
const Company = require('../models/Company');
require('dayjs-ext');

class ContactsController
{
    /**
     * [CLIENTS]
    */
    static async SaveClient (req, res) {
        try {
            const { image, firstName, lastName, documentId, birthDate, gender, occupation, cellphone, phone, email, province, municipality, sector, address, clientNumber, clientNotes, saveNote } = {...req.body}
            const token = Token.getData(req)

            if ( (!firstName || !lastName || !gender) && !saveNote ) {
                return res.json({status: false, message: IResponseMessage.SYSTEM.COMPLETE_ALL_FIELDS})
            }

            let client = {}

            if (saveNote) { // SOLO GUARDAR NOTA DEL CLIENTE
                client = {
                    saveNote,
                    clientNotes,
                    clientNumber,
                    companyId: token.companyId
                }
            } else { // GUARDAR CLIENTE COMPLETO
                client = {
                    image,
                    firstName,
                    lastName,
                    documentId,
                    birthDate: dayjs(birthDate).valueOf(),
                    gender,
                    occupation,
                    cellphone,
                    phone,
                    email,
                    province,
                    municipality,
                    sector,
                    address,
                    clientNumber,
                    createdAt: Date.now(),
                    createdBy: token.userId,
                    companyId: token.companyId
                }
            }

            const response = await Client.SaveClient(client)

            if (response.status) {

                /** 
                     * [GUARDAR NOTA]
                    */
                if (clientNumber) {
                    await helper.saveNote({
                        note: `Un usuario ha editado el cliente #${clientNumber}`,
                        type: 'client',
                        typeAction: 'edit',
                        referenceId: clientNumber.toString(),
                        userId: token.userId,
                        companyId: token.companyId
                    })
                } else {
                    await helper.saveNote({
                        note: `Un usuario ha registrado el cliente #${response.clientNumber}`,
                        type: 'client',
                        typeAction: 'create',
                        referenceId: response.clientNumber.toString(),
                        userId: token.userId,
                        companyId: token.companyId
                    })
                }
            }

            res.json(response)
        } catch (error) {
            console.error(error)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }

    static async DeleteClient (req, res) {
        try {
            const { clientNumber } = {...req.body}
            const companyId = Token.getData(req).companyId

            if ( !clientNumber || !companyId ) {
                return res.json({status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR})
            }

            const response = await Client.DeleteClient(clientNumber, companyId);
            res.json(response)
        } catch (error) {
            console.error('[DeleteClient in controller ] -> ' + error)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }

    static async findClient (req, res) {
        try {
            const { name } = {...req.body}

            const companyId = Token.getData(req).companyId
            const response = await Client.findClient( name, companyId )

            res.json(response)
        } catch (error) {
            res.json({status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR})
        }
    }

    static async GetClientList (req, res) {
        try {
            const { search, currentPage, itemsPerPage } = {...req.body}
            const companyId = Token.getData(req).companyId;

            const totalClients = await Client.getTotalClients(companyId, search)
            const response = await Client.GetClientList(companyId, search, helper.getPaginationCurrentPage(currentPage, itemsPerPage), itemsPerPage);

            if (response.status) {
                const clients = response.clients
                const provices = await helper.getProvinces()
                const municipalities = await helper.getMunicipality({ provinceId: null })
                const sectors = await helper.getSectors({ municipalityId: null })

                clients.forEach( (client, index) => {
                    response.clients[index].provinceName = provices.find( province => province._id.toString() === client.province)?.name
                    response.clients[index].municipalityName = municipalities.find( municipality => municipality._id.toString() === client.municipality)?.name
                    response.clients[index].sectorName = sectors.find( sector => sector._id.toString() === client.sector)?.name
                })
            }
            
            return res.json({
                ...response,
                totalClients
            })
        } catch (error) {
            console.error('[GetClientList in controller] ->' + error);
            return res.json({status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR})
        }
    }

    static async GetClient (req, res) {
        try {
            const companyId = Token.getData(req).companyId
            const { clientNumber, getSales } = {...req.body}

            const response = await Client.GetClient(companyId, clientNumber, getSales);

            if (response.status && getSales) {
                const client = response.client;
                const provices = await helper.getProvinces()
                const municipalities = await helper.getMunicipality({ provinceId: client.province })
                const sectors = await helper.getSectors({ municipalityId: client.municipality })

                response.client.sales = await Sale.GetClientSales(client._id);
                response.client.provinceName = provices.find( province => province._id.toString() === client.province)?.name
                response.client.municipalityName = municipalities.find( municipality => municipality._id.toString() === client.municipality)?.name
                response.client.sectorName = sectors.find( sector => sector._id.toString() === client.sector)?.name
            }
            return res.json(response)
        } catch (error) {
            console.error('[GetClientList in controller] ->' + error);
            return res.json({status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR})
        }
    }

    /**
     * [PROVIDERS]
    */
    static async getProviderView (req, res) {
        try { 
            const token = Token.getData(req)

            const categories = await Company.getCategories({
                companyId: token.companyId
            });

            res.json({
                status: true,
                categories: categories.status ? categories.categories : []
            })
        } catch (error) {
            console.error('[getProviderView] -> ', error)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }

    static async getProviders (req, res) {
        try {
            const { search, currentPage, itemsPerPage } = { ...req.body }
            const companyId = Token.getData(req).companyId;

            /** QUERY PARA BUSCAR LOS PROVEEDORES */
            let useInFind = { companyId };
                
            if (search !== '') {
                const providerName = new RegExp(search, 'i')

                useInFind = {
                    companyId,
                    name: { $regex: providerName }
                }
            }

            const totalProviders = await Provider.getTotalProviders(useInFind)
            const response = await Provider.getProviders({
                filter: useInFind,
                currentPage: helper.getPaginationCurrentPage(currentPage, itemsPerPage),
                itemsPerPage: !itemsPerPage ? 0 : itemsPerPage
            });

            let providers = Array()

            if (response.status) {
                providers = response.providers

                let categories = await Company.getCategories({
                    companyId,
                    fields: {
                        name: 1
                    }
                })

                categories = categories.status ? categories.categories : []

                providers.forEach( (provider, index) => {
                    const category = categories.find( category => category._id.toString() === provider.category.toString() )
                    providers[index].categoryData = category
                })
            }

            res.json({ status: true, providers, totalProviders })
        } catch (error) {
            console.error('[getProviders] -> ', error)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }

    static async getProvider (req, res) {
        try {
            const token = Token.getData(req)
            const { providerNumber } = req.query

            if (!providerNumber) {
                return res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }

            const response = await Provider.getProvider({
                companyId: token.companyId,
                providerNumber: parseInt(providerNumber),
                providerId: null,
                fields: {
                    name: 1,
                    category: 1,
                    rnc: 1,
                    address: 1,
                    phone: 1,
                    email: 1,
                    webSite: 1,
                    comments: 1,
                    createdBy: 1,
                    createdAt: 1,
                    providerNumber: 1
                }
            }) 

            if (response.status) {
                const oldCategory = response.provider.category
                let categories = await Company.getCategories({
                    companyId: token.companyId,
                    fields: {
                        name: 1
                    }
                })

                categories = categories.status ? categories.categories : []

                const category = categories.find( category => category._id.toString() === oldCategory )
                response.provider.categoryData = category
            }

            res.json(response)
        } catch (error) {
            console.error('[getProvider] -> ', error)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }

    static async saveProvider (req, res) {
        try {
            const { name, category, rnc, address, phone, email, webSite, comments, providerNumber } = {...req.body}
            const token = Token.getData(req)

            if (!name || !address || !phone) {
                return res.json({status: false, message: IResponseMessage.SYSTEM.COMPLETE_ALL_FIELDS})
            }

            let provider = {
                name,
                category,
                rnc,
                address,
                phone,
                email,
                webSite,
                comments,
                companyId: token.companyId,
                createdBy: token.userId,
                createdAt: dayjs().valueOf()
            }

            if (providerNumber) {
                delete provider.companyId
                delete provider.createdBy
                delete provider.createdAt

                provider.providerNumber = parseInt(providerNumber)
            }

            const response = await Provider.saveProvider({
                provider,
                providerNumber: providerNumber ? parseInt(providerNumber) : null,
                companyId: token.companyId
            })

            if (response.status) {
                
                /** 
                    * [GUARDAR NOTA]
                */
                 if (providerNumber) {
                    await helper.saveNote({
                        note: `Un usuario ha editado el proveedor #${providerNumber}`,
                        type: 'provider',
                        typeAction: 'edit',
                        referenceId: providerNumber.toString(),
                        userId: token.userId,
                        companyId: token.companyId
                    })
                } else {
                    await helper.saveNote({
                        note: `Un usuario ha registrado el proveedor #${response.providerNumber}`,
                        type: 'provider',
                        typeAction: 'create',
                        referenceId: response.providerNumber.toString(),
                        userId: token.userId,
                        companyId: token.companyId
                    })
                }
            }

            res.json(response)
        } catch (error) {
            console.error('[saveProvider] -> ', error)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }

    static async deleteProvider (req, res) {
        try {
            const { providerNumber } = { ...req.body }
            const token = Token.getData(req)

            if (!providerNumber) {
                return res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }

            const response = await Provider.deleteProvider({ 
                companyId: token.companyId,
                providerNumber: parseInt(providerNumber)
            })

            res.json(response)
        } catch (error) {
            console.error('[deleteProvider] -> ', error)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }
}

module.exports = ContactsController