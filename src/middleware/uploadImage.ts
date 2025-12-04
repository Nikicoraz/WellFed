import { fileURLToPath } from 'url';
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadImage = (imagePath: string) => { 
    return multer({
        storage: multer.diskStorage({
            destination: (req, file, cb) => {
                const uploadDir = path.join(__dirname, "..", "..", "..", "public", "images", imagePath);
                cb(null, uploadDir);
            },
            filename: (req, file, cb) => {
                cb(null, uuidv4() + path.extname(file.originalname));
            },
        }),

        fileFilter: (req, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
            if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'image/webp') {
                cb(null, true);
            } else {
                cb(new Error("Unsupported image file format"));
            }
        },

        limits: {
            fileSize: 1024 * 1024,
        }
    });
};

export default uploadImage;