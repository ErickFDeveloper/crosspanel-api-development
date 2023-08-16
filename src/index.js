/**
 * Port and Environment settings
 */
const getDotenvConfig = require('./config/environment');
require('dotenv').config(getDotenvConfig());

const PORT = process.env.PORT;
const ENVIRONMENT = process.env.NODE_ENV;

const express = require('express');
const server = express();
const Router = require('./router/index');
const cors = require('cors');
const dayjs = require('dayjs');
require('dayjs/locale/es');
dayjs.locale('es')

/**
 * App settings
 */
server.set('port', PORT);
server.set('json spaces', 2);

/**
 * [CONFIGURAR HELPER]
*/
global.helper = require('./utils/helper')

/**
 * [MIDDLEWARES]
 * Functions that are executed before reaching the endpoint handler
 */
server.use(
    cors({
        methods: ['GET', 'POST', 'DELETE', 'PUT']
    })
);
server.use(express.json());
server.use(express.urlencoded({ extended: true }));
server.use('/public', express.static('./src/public'));
server.use('/public/images', express.static('./storage/images'));
Router(server);

/**
 * [Middleware for errors]
 * Any errors not caught at some point in the overall flow are handled here.
 */
server.use((error, req, res, next) => {
    if (error)
    {
        console.error(error.stack);
        res.status(500).json({
            status: false,
            message: 'An error has occurred in the server',
        });
        next();
    }
});

server.listen(server.get('port'), () => {
    console.log(`CrossPanel API listen on: ${server.get('port')}`);
    console.log(`CrossPanel API is running in mode ${ENVIRONMENT}`);
});
