const { MongoClient } = require('mongodb');

function initDbConnection() {
	return new Promise(async (resolve) => {
		const mongoClient = new MongoClient(process.env.MONGODB_URI);
		await mongoClient.connect();
		const db = mongoClient.db(process.env.MONGODB_DBNAME);
		resolve({ db, mongoClient });
	});
}

module.exports = initDbConnection;
