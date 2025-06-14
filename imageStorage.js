const multer = require("multer");
const aws = require("aws-sdk");
// const { Settings } = require("../models/settings");

aws.config.update({
  secretAccessKey: "IiZBROeWeAzQ6TurDgX8O+/CxaUfKKSBcvmTqVQK",
  accessKeyId: "AKIA2ZRVPCLBPM2TVFPO",
  region: "eu-west-1",
});

const FILE_TYPE_MAP = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/jpg": "jpg",
};

const uploadbasicMulter = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      console.log("object : " , file)
      const isValid = FILE_TYPE_MAP[file.mimetype];
      let uploadError = new Error("invalid image type");
      if (isValid) uploadError = null;

      // if (fs.existsSync(`./public/uploads/${file.originalname}`)) {
      //   // path exists
      //   console.log("exists:", `./public/uploads/${file.originalname}`);
      //   delete file

      // } else {
      //   console.log("DOES NOT exist:", `./public/uploads/${file.originalname}`);
      // }

      cb(uploadError, "public/uploads");
    },
    filename: function (req, file, cb) {
      cb(null, `${file.originalname}`);
    },
  }),
});

const postImageLocatianSpecify = (req) => {
  const fileName = req.file ? req.file.filename : '';
  const basePath = `${req.protocol}://${req.get("host")}/public/uploads/`;
  
    return `${basePath}${fileName}`
  
}




module.exports.whichUpload = uploadbasicMulter
module.exports.postImageLocatianSpecify = postImageLocatianSpecify


