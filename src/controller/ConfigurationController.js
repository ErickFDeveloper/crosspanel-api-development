const IResponseMessage = require('../interfaces/ResponseMessage');
const bcrypt = require('bcrypt');
const Token = require('../utils/token');
const Company = require('../models/Company');
const User = require('../models/User');
const Inventory = require('../models/Inventory')
const dayjs = require('dayjs');
const { ObjectId } = require('mongodb');
require('dayjs/locale/es')

class ConfigurationController
{
    static async getConfigurationData (req, res) {
        try {
            dayjs.locale('es')
            const { section } = req.body;
            const token = Token.getData(req);

            let data;

            if (section === 'general-data') {
                data = await Company.generalData({
                    companyId: token.companyId,
                    fields: {
                        name: 1,
                        address: 1,
                        phone: 1,
                        type: 1,
                        oversale: 1,
                        creditSales: 1,
                        unknownSales: 1,
                        logotype: 1
                    }
                });

                const user = await User.findById({
                    userId: token.userId,
                    fields: {
                        name: 1,
                        lastName: 1,
                        email: 1,
                        username: 1
                    }
                });

                data.user = user && user.status ? 
                    user.user : []
            } else if (section == 'comprobantes') {
                data = await Company.generalData({
                    companyId: token.companyId,
                    fields: {
                        useComprobantes: 1
                    }
                });

                const comprobantes = await Inventory.findComprobantes(token.companyId);
                data.comprobantes = comprobantes ? 
                    comprobantes.comprobantes : [];

                data.comprobantes.forEach( (comprobante, index) => {
                    data.comprobantes[index].expirationDate = dayjs(comprobante.expirationDate).format('dddd, D [de] MMMM [de] YYYY')
                });
            } else if (section === 'warehouse') {
                data = await Company.getEstablishments({ companyId: token.companyId })
            } else if (section === 'taxes') {
                const taxList = await Company.getTaxList( token.companyId )

                data = { status: true, taxes: taxList }
            } else {
                // EN CASO DE QUE NO SE ENVIE UNA SECCION EXISTENTE.
                data = { status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR }
            }

            res.json(data)
        } catch (error) {
            console.error('[getConfigurationData] -> ', error)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }

    static async saveGeneralData (req, res) {
        try {
            const { companyName, logotype, type, companyPhone, companyAddress, oversale, creditSales, unknownSales, firstName, lastName, username, email, password, repeatPassword } = req.body;
            const token = Token.getData(req);

            /** VALIDATIONS */
            if (!companyName && !type) {
                return res.json({ status: false, message:IResponseMessage.SYSTEM.COMPLETE_ALL_FIELDS });
            }

            if (password && password !== repeatPassword) {
                console.log(password, repeatPassword)
                return res.json({ status: false, message: IResponseMessage.REGISTER.PASSWORDS_MUST_BE_THE_SAME });
            }

            const companyData = {
                name: companyName,
                logotype,
                phone: companyPhone,
                address: companyAddress,
                type,
                oversale,
                creditSales,
                unknownSales,
            }

            const userData = {
                name: firstName,
                lastName,
                username,
                email
            }

            if (password) {
                const encryptedPassword = await bcrypt.hash(password, 10);
                userData.password = encryptedPassword
            }

            /** SAVE DATA */
            const companyResponse = await Company.setCompanyData({ // COMPANY DATA
                data: companyData,
                companyId: token.companyId
            })

            const userResponse = await User.updateById({
                user: userData,
                userId: token.userId
            })

            companyResponse.status && userResponse.status ?
                res.json({ status: true, message: IResponseMessage.SYSTEM.DATA_SAVED }) 
                : res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })

        } catch (error) {
            
        }
    }

    static async saveComprobantes (req, res) {
        try {
            const { useComprobantes, comprobanteId, name, code, firstNumber, lastNumber, expirationDate } = req.body;
            const token = Token.getData(req);

            /** GUARDAR LA OPCION DE UTILIZAR COMPROBANTE */
            if (useComprobantes == 1 || useComprobantes == 0) {
                const companyResponse = await Company.setCompanyData({
                    data: {
                        useComprobantes
                    },
                    companyId: token.companyId
                })

                return res.json(companyResponse)
            }

            if (!name, !code, !firstNumber, !lastNumber, !expirationDate) {
                return res.json({ status: false, message: IResponseMessage.SYSTEM.COMPLETE_ALL_FIELDS })
            }

            /** GUARDAR UN COMPROBANTE EN LA TABLA DE COMPROBANTES */
            const data = {
                _id: comprobanteId,
                name,
                code, 
                firstNumber,
                lastNumber,
                expirationDate: dayjs(expirationDate).valueOf(),
                companyId: token.companyId
            }

            const response = await Inventory.saveComprobante(data)

            res.json(response)
        } catch (error) {
            console.error('[saveComprobantes] in Controller -> ', error)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }

    static async saveEstablishment (req, res) {
        try {
            const { name, note, establishmentId, isEditing } = req.body;
            const token = Token.getData(req);

            if (!name || !note) return res.json({ status: false, message: IResponseMessage.SYSTEM.COMPLETE_ALL_FIELDS })

            const data = {
                _id: new ObjectId(),
                name,
                note
            }

            let response

            if (isEditing === 'true') {
                delete data._id

                data.establishmentId = new ObjectId(establishmentId)
                response = await Company.saveEstablishment({ companyId: token.companyId, establishment: data })
            } else {    
                response = await Company.saveEstablishment({ companyId: token.companyId, establishment: data })
            }

            /** GUARDAR NOTA */
            if (response.status) {

                /**
                 * [GUARDAR NOTA]
                */
                if (isEditing === 'true') {
                    await helper.saveNote({
                        note: `Un usuario ha editado el establecimiento ${name}`,
                        type: 'establishment',
                        typeAction: 'edit',
                        referenceId: establishmentId,
                        userId: token.userId,
                        companyId: token.companyId
                    })
                } else {
                    await helper.saveNote({
                        note: `Un usuario ha creado el establecimiento ${name}`,
                        type: 'establishment',
                        typeAction: 'create',
                        referenceId: data._id,
                        userId: token.userId,
                        companyId: token.companyId
                    })
                }
            }

            res.json(response)
        } catch (error) {
            console.error('[saveEstablishment] in Controller -> ', error)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }

    static async deleteEstablishment (req, res) {
        try {
            const { establishmentId, name } = req.body;
            const token = Token.getData(req);

            if (!establishmentId) return res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })

            const response = await Company.deleteEstablishment({ 
                companyId: token.companyId,
                establishmentId: new ObjectId(establishmentId)
            })

            /** GUARDAR NOTA */
            if (response.status) {
                await helper.saveNote({
                    note: `Un usuario ha eliminado el establecimiento ${name}!`,
                    type: 'establishment',
                    typeAction: 'delete',
                    referenceId: '',
                    userId: token.userId,
                    companyId: token.companyId
                })
            }

            res.json(response)
        } catch (error) {
            console.error('[deleteEstablishment] in Controller -> ', error)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }

    static async getNotes (req, res)
    {
        try {
            const { limit } = { ...req.body }
            const token = Token.getData(req)

            const response = await Company.getNotes({ companyId: token.companyId, limit })

            res.json(response)
        } catch (error) {
            console.error('[getNotes] -> ', error)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }

    static async getMunicipalities (req, res)
    {
        try {
            const { id } = req.body

            if (!id)
                return res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })

            const municipalities = await helper.getMunicipality({ provinceId: id })

            res.json({ status: true, municipalities })
        } catch (error) {
            console.error('[getMunicipalities] -> ', error)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }

    static async getSectors (req, res)
    {
        try {
            const { id } = req.body

            if (!id)
                return res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })

            const sectors = await helper.getSectors({ municipalityId: id })

            res.json({ status: true, sectors })
        } catch (error) {
            console.error('[getSectors] -> ', error)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }

    static async saveTax (req, res) {
        try {
            const { name, rate, taxId, isEditing } = req.body;
            const token = Token.getData(req);

            if (!name || !rate) return res.json({ status: false, message: IResponseMessage.SYSTEM.COMPLETE_ALL_FIELDS })

            const tax = {
                _id: new ObjectId(),
                name,
                rate: parseFloat(rate)
            }

            let response

            if (isEditing === 'true') {
                delete tax._id

                tax.id = new ObjectId(taxId)
                response = await Company.saveTax({ companyId: token.companyId, tax })
            } else {    
                response = await Company.saveTax({ companyId: token.companyId, tax })
            }

            res.json(response)
        } catch (error) {
            console.error('[saveTax] in Controller -> ', error)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }

    static async deleteTax (req, res) {
        try {
            const { taxId } = req.body;
            const token = Token.getData(req);

            if (!taxId) return res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })

            const response = await Company.deleteTax({ 
                companyId: token.companyId,
                taxId: new ObjectId(taxId)
            })

            res.json(response)
        } catch (error) {
            console.error('[deleteTax] in Controller -> ', error)
            res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }
}

module.exports = ConfigurationController