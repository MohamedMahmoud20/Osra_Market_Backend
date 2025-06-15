const multer = require("multer");
const storage = require("./utils/cloudinaryStorage");

const uploadbasicMulter = multer({ storage });

module.exports.whichUpload = uploadbasicMulter;