const Language = require('../models/Language')
const IResponseMessage = require('../interfaces/ResponseMessage')
class LanguageController
{
    static async getAllLanguages(req, res)
    {
        try {
            const languages = await Language.getAllLanguages();

            if (languages.length > 0) {
                return res.json({ status: true, data: languages })
            }
            return res.json({ status: true, data: [] })
        }
        catch (error) {
            console.error(error);
            return res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }

    static async getLanguageByIso(req, res)
    {
        try {
            const iso = req.params.iso;
            const language = await Language.getLanguageByIso(iso);

            if (language) {
                return res.json({ status: true, data: language })
            }
            return res.json({ status: true, data: [] })
        }
        catch (error) {
            console.error(error);
            return res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
        }
    }
}

module.exports = LanguageController