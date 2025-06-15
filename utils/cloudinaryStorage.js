const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("./cloudinary");

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "user_images",
    allowed_formats: ["jpg", "jpeg", "png"],
    public_id: (req, file) => {
      const name = file.originalname.split(".")[0];
      return `user_${Date.now()}_${name}`;
    }
  }
});

module.exports = storage;
