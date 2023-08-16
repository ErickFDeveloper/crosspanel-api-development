const HomeRouter = require('./home.router');
const AuthRouter = require('./auth.router');
const LanguageRouter = require('./language.router');
const Sales = require('./sales.router');
const Inventory = require('./inventory.router');
const PostsRouter = require('./posts.router')
const UtilsRouter = require('./utils.router');
const Contacts = require('./contacts.router');
const Configuration = require('./configuration.router')
const Dashboard = require('./dashboard.router')
const Expenses = require('./expenses.router')
const Purchases = require('./purchases.router')

module.exports = (server) => {
  server.get('/', HomeRouter);
  server.use('/api/v1/auth/', [AuthRouter]);
  server.use('/api/v1/sales/', [Sales]);
  server.use('/api/v1/inventory/', [Inventory]);
  server.use('/api/v1/language/', [LanguageRouter]);
  server.use('/api/v1/posts/', [PostsRouter]);
  server.use('/api/v1/utils/', [UtilsRouter]);
  server.use('/api/v1/contacts/', [Contacts]);
  server.use('/api/v1/configuration/', [Configuration]);
  server.use('/api/v1/dashboard/', [Dashboard]);
  server.use('/api/v1/expenses/', [Expenses]);
  server.use('/api/v1/purchase/', [Purchases]);
};
