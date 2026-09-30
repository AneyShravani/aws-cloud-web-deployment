// ============================================================
// MIDDLEWARE: upload (multer — HOD letter uploads)
// ------------------------------------------------------------
// Handles the "letter of submission from the HOD" file:
// - store in backend/src/uploads/ (unique filename)
// - allow only pdf / doc / docx / images, limit file size
// - attach the saved path to the request for the controller.
// ============================================================


const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = path.join(__dirname, "..", "uploads");

// ensure uploads folder exists
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // unique filename: timestamp-random-originalname
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const ext = path.extname(file.originalname);
        cb(null, `hodletter-${uniqueSuffix}${ext}`);
    },
});

const allowedTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg",
    "image/png",
];

const fileFilter = (req, file, cb) => {
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Invalid file type. Only PDF, DOC, DOCX, JPG, PNG allowed."), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

// exported as single-file upload middleware for field name "hodLetter"
module.exports = upload.single("hodLetter");