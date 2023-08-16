const bcrypt = require('bcrypt');
const { MongoServerError, ObjectId } = require('mongodb');
const initDbConnection = require('../config/db');
const IResponseMessage = require('../interfaces/ResponseMessage');
const ICollectionNames = require('../interfaces/Collections');
const { ObjectID } = require('bson');

class User
{

	/**
	 * @param {object} user Data of user to create
	 * */
	static async create(user)
	{
		const { db, mongoClient } = await initDbConnection();
		const userCreated = await db.collection('users').insertOne(user);
		mongoClient.close();

		if (!!userCreated)
			return { status: true, user: userCreated }

		return { status: false }
	}

	/**
	 * @param {object} fieldsToFind Fields to find
	 * */
	static async alreadyExist(fieldsToFind)
	{
		const { db, mongoClient } = await initDbConnection();
		const user = await db.collection('users').findOne(fieldsToFind);
		mongoClient.close();

		return !!user;
	}

	/**
	 * @param {object} data
	 * @param {string} data.username Username
	 * @param {object} data.fields Fields to find
	 * */
	static findByUsername({ username, fields })
	{
		return new Promise(async (resolve) => {

			if (!!username && typeof username === 'string')
			{
                const { db, mongoClient } = await initDbConnection();
                const user = await db
					.collection(ICollectionNames.USERS)
					.find({ username })
					.project(fields ? fields : {})
					.toArray();
					
                mongoClient.close();

                if (user.length > 0)
					return resolve({ status: true, user: user[0] });

                return resolve({ status: false });
			}
            return resolve({ status: false });
		});
	}

	/**
	 * @param {object} data
	 * @param {ObjectId} data.userId User id
	 * @param {object} data.fields Fields to find
	 * @return {object} User data
	* */
	static findById({ userId, fields })
	{
		return new Promise(async (resolve) => {

			if (!!userId && typeof userId === 'string')
			{
				const _id = new ObjectID(userId)
                const { db, mongoClient } = await initDbConnection();
                const user = await db.collection('users').find({ _id }).project(fields ? fields : {}).toArray();
                mongoClient.close();

                if (user.length > 0)
					return resolve({ status: true, user: user[0] });

                return resolve({ status: false });
			}
            return resolve({ status: false });
		});
	}

	static updateById ({ user, userId }) {
        return new Promise ( async (resolve, reject) => {
            try {
                const _id = new ObjectID(userId);
                const { db, mongoClient } = await initDbConnection();
                await db.collection('users').updateOne( { _id }, { 
                    $set: {...user} 
                })

                mongoClient.close()
                resolve({ status: true, message: IResponseMessage.SYSTEM.DATA_SAVED })
            } catch (error) {
                console.error('[updateById] in Model -> ', error)
                return reject({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR })
            }
        })
    }
}

module.exports = User;
