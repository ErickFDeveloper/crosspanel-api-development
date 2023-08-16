const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: 'erickenmanuelfeliz@gmail.com',
    pass: 'kykopnpnclncqrzl',
  },
});

module.exports = transporter;