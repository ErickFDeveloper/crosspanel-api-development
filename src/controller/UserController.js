const { MongoServerError } = require('mongodb');
const initDbConnection = require('../config/db');

class UserController {
    static async existUser(userName) {
        let exist = false;
        try
        {
            const { db, client: mongoClient } = await initDbConnection();
            const existUser = await db.collection('users').findOne({ name: userName });
            mongoClient.close();
            exist = !!existUser;
        }
        catch (error)
        {
            if (error instanceof MongoServerError) {
                console.log(error.errInfo.details);
                return;
            }
            console.log(error);
        }

        return exist;
    }
}

module.exports = UserController;
