const Counter = require("../models/Counter");

const findOne = (filter, options = {}) =>
  Object.keys(options).length
    ? Counter.findOne(filter, undefined, options)
    : Counter.findOne(filter);

const findOneAndUpdate = (filter, update, options = {}) =>
  Counter.findOneAndUpdate(filter, update, options);

module.exports = { findOne, findOneAndUpdate };
