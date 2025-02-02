const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const Schema = mongoose.Schema;

// schema for Projects
const projectSchema = new Schema({
  name: { type: String, required: true },
  description: String,
  startDate: Date,
  endDate: Date
}, { timestamps: true });

const Project = mongoose.model('Project', projectSchema);

// SCHEMA for Tasks
const taskSchema = new Schema({
  project: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  name: { type: String, required: true },
  description: String,
  durationDays: Number, 
  startDate: Date,
  endDate: Date
}, { timestamps: true });

const Task = mongoose.model('Task', taskSchema);

module.exports = { router, Project, Task };