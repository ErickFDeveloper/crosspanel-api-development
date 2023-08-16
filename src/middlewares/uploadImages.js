const uuid = require('uuid');
const multer = require('multer');

const storage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, 'src/storage/images');
    },
    filename(req, file, cb) {
        const id = uuid.v4();
        const fileExtension = file.mimetype.split('/')[1];
        const fileName = `${file.originalname + id}.${fileExtension}`;
        cb(null, fileName);
    }
})
  
const upload = multer({ storage: storage });

module.exports = upload;