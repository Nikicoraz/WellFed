import multer from "multer";
import path from "path";

const merchantStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const merchantId = req.body.id;
    const uploadDir = path.join(__dirname, '..', '..', 'public', 'images', merchantId.toString());
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const merchantId = req.body.id;
    cb(null, merchantId.toString() + path.extname(file.originalname));
  },
});