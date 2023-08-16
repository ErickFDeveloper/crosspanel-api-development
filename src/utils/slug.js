const uniqueSlug = require('unique-slug');
const slug = require('slug');
const initDbConnection = require('../config/db');
const { ObjectId } = require('mongodb');
const ICollectionNames = require('../interfaces/Collections');

const getSlug = async ({ text, postId }) => {
	let dbClient = null;
	try
	{
		if ((!!text && typeof text !== 'string') || !postId) return false;

		let slugText = slug(text);

		const { db, mongoClient } = await initDbConnection();
		dbClient = mongoClient;

		const post = await db.collection(ICollectionNames.POSTS).findOne({ _id: new ObjectId(postId) });

		if (post.slug !== slugText)
		{
			const newSlugExists = await db.collection(ICollectionNames.POSTS).findOne({ slug: slugText });

			if (newSlugExists)
				slugText = `${slug(text)}-${uniqueSlug()}`;
		}
		dbClient.close();

		return slugText;
	}
	catch (error)
	{
		dbClient.close();
		console.error(`[getSlug] -> ${error.message || error}`);
		return false;
	}
}

module.exports = getSlug