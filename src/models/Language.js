const initDbConnection = require('../config/db')
class Language
{
    static async getAllLanguages() {
        const { db, mongoClient } = await initDbConnection()
        const languages = await db.collection('languages').find({}).project({ _id: false }).toArray();
        mongoClient.close();
        return languages.length > 0 ? languages : []
    }

    /**
     * @param {string} iso Iso code of language
     * */
    static async getLanguageByIso(iso) {
        const { db, mongoClient } = await initDbConnection()
        const [ language ] = await db.collection('languages').find({ iso }).project({ _id: false }).toArray();
        mongoClient.close();
        return language;
    }
}

module.exports = Language