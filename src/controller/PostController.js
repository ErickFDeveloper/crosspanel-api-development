/**
 * [INTERFACES]
 */
const IResponseMessage = require('../interfaces/ResponseMessage');
const ICollectionNames = require('../interfaces/Collections');

const uniqueSlug = require('unique-slug');
const slug = require('slug');
const sanitizeHtml = require('sanitize-html');
const dayjs = require('dayjs');
const initDbConnection = require('../config/db');
const { ObjectId } = require('mongodb');
const getSlug = require('../utils/slug');

/**
 * [MODELS]
 */
const Posts = require('../models/Post');

class PostController
{
	static controllerName = 'PostController';

	static async create(req, res)
	{
		let dbClient;
		try
		{
			let { postTitle, postContent, category, deltaContent } = req.body;
			const { db, mongoClient } = await initDbConnection();
			dbClient = mongoClient;

			let postSlug = slug(postTitle);
			const alreadyExistThisSlug = await db.collection(ICollectionNames.POSTS).findOne({ slug: postSlug });

			if (alreadyExistThisSlug)
				postSlug = `${slug(postTitle)}-${uniqueSlug()}`;

			const sanitizePostContent = sanitizeHtml(postContent, {
				allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
				allowedAttributes: {
					img: ['src']
				},
				allowedSchemes: ['data', 'http', 'https']
			});

			if (!Array.isArray(category))
				category = []
			
			if (!!postTitle && !!postContent)
			{
				const result = await Posts.create({
					title: postTitle,
					content: sanitizePostContent,
					category,
					slug: postSlug,
					deltaContent,
					status: 1
				});

				if (result.status) {
					return res.json({ status: true, message: 'Publicación creada correctamente.', slug: postSlug })
				}
			}

			return res.json({ status: false, message: 'Complete los campos' });

		}
		catch (error)
		{
			dbClient.close();
			console.error(`[${PostController.controllerName}.create] -> ${error.message || error}`);
			return res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR });
		}
	}

	static async update(req, res)
	{
		try
		{
			let { postId, postTitle, postContent, category, deltaContent } = req.body;

			if (!postId || !postTitle || !postContent || !category || !deltaContent)
				return ({ status: false, message: 'Se deben llenar todos los campos' });

			const newSlug = await getSlug({ text: postTitle, postId });
			if (!newSlug)
				return res.json({
					status: false,
					message: 'No se pudo obtener URL de la publicación'
				})

			const { status, updatedPost } = await Posts.update({
				postId: new ObjectId(postId),
				postTitle,
				postContent,
				category,
				slug: newSlug,
				deltaContent
			});

			if (!status) return ({ status, message: 'No se pudo actualizar la publicación' });

			return res.json({
				status,
				post: updatedPost,
				message: 'La publicación se actualizó correctamente'
			});
		}
		catch (error)
		{
			console.error(`[${PostController.controllerName}] -> ${error.message || error}`);
			return res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR });
		}
	}

	static async deleteOne(req, res)
	{
		try
		{	
			const { postId } = req.body;
			if (!!postId)
			{
				const { status, deletedPost } = await Posts.deleteOne(postId);
				if (!status)
					return res.json({ status: false, message: 'Error' });

				return res.json({ status: true, data: deletedPost });
			}

			return res.json({ status: false, message: 'Debe proveer un id de publicación' })

		}
		catch (error)
		{
			console.error(`[${PostController.controllerName}.deleteOne] -> ${error.message}`);
			return res.json({ status: false, message: 'Error' });
		}
	}

	static async getAllPosts(req, res)
	{
		try
		{
			const { status, posts } = await Posts.getAll();

			if (status)
				return res.json({ status: true, data: posts });

			return res.json({ status: false });
		}
		catch (error)
		{
			console.error(`[${PostController.controllerName}.getAllPosts]: ${error.message || error}`);
			return res.json({ status: false, message: 'Error' });
		}
	}

	static async find(req, res)
	{
		try
		{
			const { title, dateFrom, dateTo, status } = req.query
			const formattedDateFrom = dayjs(dateFrom).startOf('day').valueOf();
			const formattedDateTo = dayjs(dateTo).endOf('day').valueOf();

			const postsStatus = {
				all: {
					$in: [1, 0]
				},
				active: 1,
				inactive: 0
			}
			const filters = {
				title: {
					$regex: title || '',
					$options: 'i'
				},
				createdAt: {
					$gte: formattedDateFrom,
					$lte: formattedDateTo
				},
				status: postsStatus[status]
			}

			const { status: findStatus, posts } = await Posts.find(filters);

			if (findStatus)
				return res.json({ status: true, data: posts });
			
			return res.json({ status: false });
		}
		catch (error)
		{
			console.error(`[${PostController.controllerName}.findByTitle] -> ${error.message}`);
			return res.json({ status: false, message: 'Error' });
		}
	}

	static async findBySlug(req, res)
	{
		try
		{
			const { slug } = req.query;
			if (!!slug)
			{
				const { status, post } = await Posts.findBySlug(slug);
				if (status)
				{
					return res.json({
						status: true,
						data: post
					});
				}
			}

			return res.json({ status: false, message: 'Debe proveer un slug correcto' });
		}
		catch (error)
		{
			console.error(`[${PostController.controllerName}.findBySlug] -> ${error.message}`);
			return res.json({
				status: false,
				message: 'error'
			});
		}
	}
}

module.exports = PostController;