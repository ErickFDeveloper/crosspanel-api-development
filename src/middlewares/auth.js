const IResponseMessage = require('../interfaces/ResponseMessage');
const Token = require('../utils/token');

const auth = (req, res, next) => {
    try
    {
        Token.validate(Token.getToken(req));
        next();
    }
    catch (error)
    {
        console.error(`[auth] -> ${error.message}`);
        return res.json({ status: false, message: IResponseMessage.TOKEN.TOKEN_IS_INVALID });
    }
};

module.exports = auth;
