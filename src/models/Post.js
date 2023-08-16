const { ObjectId } = require('mongodb');
const initDbConnection = require('../config/db');

const ICollectionNames = require('../interfaces/Collections');

class Posts {

	static modelName = 'Posts'

	static async create(fields)
	{
		const { db, mongoClient } = await initDbConnection();
		try
		{
			const { title, content, category, slug, deltaContent, status } = fields;
			const result = await db
				.collection(ICollectionNames.POSTS)
				.insertOne({ title, content, category, slug, deltaContent, createdAt: Date.now(), status });
			mongoClient.close();

			if (result.acknowledged) {
				return ({ status: true });
			}

			return ({ status: false });
		}
		catch (error)
		{
			console.error(error);
			mongoClient.close();
			return ({ status: false, message: 'Error' });
		}
	}

	static async update(fields)
	{
		let dbClient;
		try
		{
			const { db, mongoClient } = await initDbConnection();
			dbClient = mongoClient;

			const { postId, postTitle, postContent, category, slug, deltaContent } = fields
			const result = await db.collection(ICollectionNames.POSTS).updateOne(
				{ _id: postId },
				{ $set: {
					title: postTitle,
					content: postContent,
					category,
					slug,
					deltaContent,
					updatedAt: Date.now()
				}
			});

			const updatedPost = await db.collection(ICollectionNames.POSTS).findOne({ _id: postId });

			dbClient.close();

			if (result.acknowledged) {
				return ({ status: true, updatedPost })
			}

			return ({ status: false })
		}
		catch (error)
		{
			dbClient.close();
			console.error(`[${Posts.modelName}] -> ${error.message || error}`);
		}
	}

	static async getAll()
	{
		const { db, mongoClient } = await initDbConnection();
		try
		{
			const posts = await db.collection(ICollectionNames.POSTS).find().toArray();
			mongoClient.close();

			return ({ status: true, posts });
		}
		catch (error)
		{
			console.error(`[Posts.getAll]: ${error.message || error}`);
			mongoClient.close();
			return ({ status: false });
		}
	}

	static async alreadyExist(fieldsToFind)
	{
		try {
			
		}
		catch (error) {
			
		}
	}

	static async find(filters)
	{
		let dbClient;
		try
		{
			const { db, mongoClient } = await initDbConnection();
			dbClient = mongoClient;

			const posts = await db
				.collection(ICollectionNames.POSTS)
				.find(filters)
				.sort({ createdAt: -1 })
				.toArray();

			return ({ status: true, posts });
		}
		catch (error)
		{
			dbClient.close();
			console.error(`[${Posts.modelName}.getAll] -> ${error.message}`);
			return ({ status: false });
		}
		finally
		{
			dbClient.close();
		}
	}

	static async deleteOne(postId)
	{
		let dbClient;
		try
		{
			const { db, mongoClient } = await initDbConnection();
			dbClient = mongoClient;

			const { deletedCount } = await db.collection(ICollectionNames.POSTS).deleteOne({ _id: new ObjectId(postId) });
			if (deletedCount > 0)
			{
				return ({ status: true, deletedPost: postId });
			}
		}
		catch (error)
		{
			console.error(`[${Posts.modelName}] -> ${error.message}`);
			return ({ status: false });
		}
		finally
		{
			dbClient.close();
		}
	}

	static async findBySlug(slug)
	{
		let dbClient;
		try
		{
			const { db, mongoClient } = await initDbConnection();
			dbClient = mongoClient;

			const post = await db.collection(ICollectionNames.POSTS).findOne({ slug });
			if (post)
			{
				return ({
					status: true,
					post
				})
			}
		}
		catch (error)
		{
			console.error(`[${Posts.modelName}] -> ${error.message}`);
			return ({
				status: false
			})
		}
	}
}

module.exports = Posts;