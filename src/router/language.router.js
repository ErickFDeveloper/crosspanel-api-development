const Router = require('express').Router()
const LanguageController = require('../controller/LanguageController')
const auth = require('../middlewares/auth')

Router.get('/all', auth, LanguageController.getAllLanguages);
Router.get('/:iso', auth, LanguageController.getLanguageByIso);

module.exports = Router