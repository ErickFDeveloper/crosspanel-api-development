const initDbConnection = require('../config/db');
const ICollectionNames = require('../interfaces/Collections');
const Token = require('../utils/token');

class Auth
{
	/**
	 * 
	 * @param {objectId} userId 
	 * @returns {object} Object with a status true or false
	 */
	static async isLoggedUser(userId)
	{
		try
		{
			const { db, mongoClient } = await initDbConnection();
			const user = await db.collection(ICollectionNames.LOGGED_IN_USERS).findOne({ userId });
			mongoClient.close();
			
			if (user)
			{
				Token.validate(user.token);
			}
			else
			{
				return { status: false };
			}

			return { status: true };
		}
		catch (error)
		{
			console.error(`[Auth.isLoggedUser]: ${error.message || error}`);
			await this.removeLoggedUser(userId);
			return { status: false };
		}
	}

	/**
	 * @param {string} userId 
	 * @param {string} token 
	 * @returns {object} Object with a status true or false
	 */
	static async saveLoggedUser(userId, token) {
		try
		{
			const { db, mongoClient } = await initDbConnection();
			await db.collection(ICollectionNames.LOGGED_IN_USERS).insertOne({ userId, token });
			mongoClient.close();

			return { status: true }
		}
		catch (error)
		{
			console.error(`[Auth.saveLoggedUser]: ${error.message}`);
			return { status: false }
		}
	}

	static async removeLoggedUser(userId) {
		try
		{
			const { db, mongoClient } = await initDbConnection();
			const { deletedCount } = await db.collection(ICollectionNames.LOGGED_IN_USERS).deleteOne({ userId });
			mongoClient.close();

			if (deletedCount >= 1) {
				return { status: true }
			}

			return { status: false }
		}
		catch (error)
		{
			console.error(`[Auth.removeLoggedUser]: ${error.message || error}`);
			return { status: false };
		}
	}

	static async getLoggedUserToken(userId) {
		try {
			const { db, mongoClient } = await initDbConnection();
			const { token } = await db.collection(ICollectionNames.LOGGED_IN_USERS).findOne({ userId });
			mongoClient.close();

			if (!token) {
				return { status: false };
			}

			return { status: true, token }
		}
		catch (error) {
			console.error(`[Auth.getLoggedUserToken]: ${error.message}`);
			return { status: false }
		}
	}
}

module.exports = Auth;