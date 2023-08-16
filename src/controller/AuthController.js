const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const IResponseMessage = require('../interfaces/ResponseMessage');
const Token = require('../utils/token');
const { ObjectID } = require('bson');
const initDbConnection = require('../config/db');
const ICollectionNames = require('../interfaces/Collections');

/**
 * [MODELS]
 */
const User = require('../models/User');
const Company = require('../models/Company');
const Auth = require('../models/Auth');
const { ObjectId } = require('mongodb');

const controllerName = 'AuthController';

class AuthController
{
	static async validateToken(req, res)
	{
		try
		{
			const token = Token.getToken(req);
			Token.validate(token);
			return res.json({ status: true, message: IResponseMessage.TOKEN.TOKEN_IS_VALID });
		}
		catch (error)
		{
			console.error(`[${controllerName}.validateToken]: ${error.message}`);
			if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError)
				return res.json({ status: false, message: IResponseMessage.TOKEN.TOKEN_IS_INVALID });

			return res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR });
		}
	}

	static async register(req, res)
	{
		try {
			const { name, lastName, email, username, companyName, companyType, password, repeatPassword } = req.body;
			const user = { name, lastName, email, username, companyName, password };

			if (!name || !lastName || !email || !username || !companyName || !companyType || !password || !repeatPassword)
				return res.json({ status: false, message: IResponseMessage.REGISTER.FILL_IN_ALL_THE_FIELDS })

			if (await User.alreadyExist({ email }))
				return res.json({ status: false, message: IResponseMessage.REGISTER.EMAIL_ALREADY_EXIST });

			if (await User.alreadyExist({ username }))
				return res.json({ status: false, message: IResponseMessage.USER.USER_ALREADY_EXIST });

			if (password !== repeatPassword)
				return res.json({ status: false, message: IResponseMessage.REGISTER.PASSWORDS_MUST_BE_THE_SAME });

			const encryptedPassword = await bcrypt.hash(password, 10);

			const companyData = {
				name: companyName,
				type: companyType,
				clientQuantity: 1,
				productQuantity: 1,
				providerQuantity: 1,
				purchaseQuantity: 1,
				saleQuantity: 1,
				establishments: [],
				taxes: [
					{ id: new ObjectId(), name: 'ITBIS 18%', rate: 18 },
				]
			}
			const company = await Company.create(companyData);
	
			if (!!company)
			{
				await User.create({ ...user, password: encryptedPassword, companyId: company.insertedId, sysLang: 'es' });
				return res.json({ status: true, message: IResponseMessage.USER.CREATED_USER });
			}

			return res.json({ status: false, message: IResponseMessage.USER.FAILED_CREATING_USER });
		}
		catch (error)
		{
			console.error(`[${controllerName}.register]: ${error.message}`);
			return res.json({ status: false, message: IResponseMessage.USER.FAILED_CREATING_USER });
		}
	}

	static async login(req, res)
	{
		try
		{
			const { username, password } = req.body;
			if (!username || !password)
				return res.json({ status: false, message: IResponseMessage.LOGIN.PROVIDE_AN_USER_AND_PASSWORD });

			const fieldsToFind = { _id: 1, username: 1,	password: 1, companyId: 1, sysLang: 1, name: 1	};
			const { status, user } = await User.findByUsername({ username, fields: fieldsToFind });

			if (!status)
				return res.json({ status: false, message: IResponseMessage.LOGIN.USER_OR_PASSWORD_ARE_INCORRECT });

			const isCorrectPassword = await bcrypt.compare(password, user.password);

			if (!isCorrectPassword)
				return res.json({ status: false, message: IResponseMessage.LOGIN.USER_OR_PASSWORD_ARE_INCORRECT });

			
			const { status: isLoggedUser } = await Auth.isLoggedUser(user._id);
			
			/**  
			 * [TRAER PROVINCIAS]
			*/
			const provinces = await helper.getProvinces()

			/**
			 * [TRAER DATOS DE LA EMPRESA]
			*/
			const company = await Company.findById({
				companyId: user.companyId,
				fields: {
					name: 1,
					type: 1,
					logotype: 1
				}
			})

			if (!isLoggedUser)
			{
				const token = Token.create({
					username: user.username,
					name: user.name,
					sysLang: user.sysLang,
					userId: user._id,
					companyId: user.companyId
				},
				{ expiresIn: '1h' });

				const { status: saveLoggedUserStatus } = await Auth.saveLoggedUser(user._id, token);
				
				if (!saveLoggedUserStatus) {
					return res.json({ status: false });
				}

				/** GUARDAR NOTA */
				await helper.saveNote({
					note: `El usuario ${user.name} ha iniciado sesion desde un dispositivo!`,
					type: 'auth',
					typeAction: 'login',
					referenceId: '',
					userId: user._id.toString(),
					companyId: user.companyId.toString()
				})

				return res.json({ status: true, token, provinces, company });
			}

			const { status: tokenStatus, token } = await Auth.getLoggedUserToken(user._id);

			if (!tokenStatus)
				return res.json({ status: false });

			return res.json({ status: true, token, provinces, company });
		}
		catch (error)
		{
			console.error(`[${controllerName}.login]: ${error.message}`);
			return res.json({ status: false, message: IResponseMessage.ERROR.UNEXPECTED_ERROR });
		}
	}

	static async logout(req, res)
	{
		const { db, mongoClient } = await initDbConnection();
		try
		{
			const userId = new ObjectID(req.body.userId);

			if (userId)
			{
				const { deletedCount } = await db.collection(ICollectionNames.LOGGED_IN_USERS).deleteOne({ userId });
				if (deletedCount > 0)
				{
					return res.json({ status: true, removedUser: req.body.userId })
				}
			}

			mongoClient.close();

			return res.json({ status: false });
		}
		catch (error)
		{
			mongoClient.close();
			console.error(`[${controllerName}] -> ${error.message}`);
			return res.json({ status: false, message: 'Error' });
		}
	}
}

module.exports = AuthController;
