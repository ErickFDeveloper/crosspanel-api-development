const path = require('path');

const getDotenvConfig = () => {
  return {
    path:
      process.env.NODE_ENV == 'development'
        ? path.join(__dirname, '../../.env.dev')
        : path.join(__dirname, '../../.env.prod'),
  };
};

module.exports = getDotenvConfig;
