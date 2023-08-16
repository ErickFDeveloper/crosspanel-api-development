const jwt = require('jsonwebtoken');

class Token
{
    /**
     * @param {object} req Request
     * @return {string} Token sended from request
     * */
    static getToken(req)
    {
        const bearerToken = req.get('Authorization').split(' ')[1];
        return !!bearerToken ? bearerToken.trim() : '';
    }

    /**
     * @param {any} data Data to sign with secret key
     * @param {object} config Config to apply for the sign
     * @return {string} Generated token
     * */
    static create(data, config)
    {
        return jwt.sign(data, process.env.JWT_SECRET_KEY, config || null);
    }

    /**
     * @param {string} token Token to validate
     * @returns {void}
     * */
    static validate(token)
    {
        jwt.verify(token, process.env.JWT_SECRET_KEY);
    }

    /**
     * @param {object} req Request
     * @returns {object|false} User data in the token or false if there is an error
     * */
    static getData(req)
    {
        try
        {
            const token = this.getToken(req);
            return jwt.verify(token, process.env.JWT_SECRET_KEY);
        }
        catch (error)
        {
            console.error(`[Token.getData] -> ${error.message}`);
            return false;
        }
    }
}

module.exports = Token
