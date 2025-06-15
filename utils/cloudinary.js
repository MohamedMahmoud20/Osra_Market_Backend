const cloudinary = require("cloudinary").v2;

cloudinary.config({
 cloud_name: 'didaxhviv', 
 api_key: '491367585298679',
  api_secret: "D3ChUO9xHJepknGv4xTJ3pTowmE"
});

module.exports = cloudinary;