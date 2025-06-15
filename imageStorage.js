const multer = require("multer");
const storage = require("./utils/cloudinaryStorage");

const uploadbasicMulter = multer({ storage });

const postImageLocatianSpecify = (req) => {
  return {
    imageUrl: req.file?.path || '',
    publicId: req.file?.filename || ''
  };
};

module.exports.whichUpload = uploadbasicMulter;
module.exports.postImageLocatianSpecify = postImageLocatianSpecify;
