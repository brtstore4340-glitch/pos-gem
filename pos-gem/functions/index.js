const admin = require("firebase-admin");
admin.initializeApp();

const posController = require("./src/controllers/posController");

exports.scanItem = posController.scanItem;
exports.calculateOrder = posController.calculateOrder;
