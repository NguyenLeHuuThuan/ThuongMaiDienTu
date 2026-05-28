const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = path.join(__dirname, '../img/restaurant');
    if (file.fieldname === 'avatar') {
      folder = path.join(__dirname, '../img/avatar');
    } else if (file.fieldname === 'issue_image' || file.fieldname === 'issue_images') {
      folder = path.join(__dirname, '../img/issue');
    }
    
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    
    let prefix = 'food';
    if (file.fieldname === 'avatar') prefix = 'avatar';
    else if (file.fieldname === 'issue_image' || file.fieldname === 'issue_images') prefix = 'issue';
    
    cb(null, `${prefix}-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Chỉ cho phép tải lên các định dạng hình ảnh
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Chỉ chấp nhận file hình ảnh (jpeg, png, gif, webp, svg)!'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // Giới hạn kích thước file 5MB
  },
  fileFilter: fileFilter
});

module.exports = upload;
