"use strict";

const functions = require("firebase-functions");

const {
  createManagedUser,
  updateManagedUser,
} = require("./callables/userManagement");

exports.createManagedUser = functions.https.onCall(createManagedUser);
exports.updateManagedUser = functions.https.onCall(updateManagedUser);