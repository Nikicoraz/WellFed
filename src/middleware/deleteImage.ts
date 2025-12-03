import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const deleteImage = async (imagePath: string) => {
    const fullPath = path.join(__dirname, "..", "..", "..", "public", "images", imagePath);
    try {
        await fs.access(fullPath); 
        await fs.unlink(fullPath);
    } catch (e) {
        console.log(e);
    }
};

export default deleteImage;