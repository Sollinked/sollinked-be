import multer from 'multer';
import path from 'path';
import appRoot from 'app-root-path';
import { v4 as uuidv4 } from 'uuid';

const contentPath = 'public/content';
const contentStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(appRoot.toString(), contentPath))
    },
    filename: function ( req, file, cb ) {
        //How could I get the new_file_name property sent from client here?
        const extension = path.extname(file.originalname);
        // const fileName = path.basename(file.originalname,extension);
        cb(null, `${uuidv4()}${extension}`);
    }
});
export const contentUpload = multer({ storage: contentStorage });