const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const Schema = mongoose.Schema;

//mongo atlas Schema for Projects
const projectSchema = new Schema({
  name: { type: String, required: true },
  description: String,
  startDate: Date,
  endDate: Date
}, { timestamps: true });

const Project = mongoose.model('Project', projectSchema);

// mongo atlas Schema for Tasks
const taskSchema = new Schema({
  project: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  name: { type: String, required: true },
  description: String,
  duration: Number,
  startDate: Date,
  endDate: Date
}, { timestamps: true });

const Task = mongoose.model('Task', taskSchema);


// CREATE a new project
router.post('/projects', async (req, res) => {
  try {
    const project = new Project(req.body);
    const savedProject = await project.save();
    res.status(201).json(savedProject);
  } catch (err) {
    console.error('Error creating project:', err);
    res.status(500).json({ error: err.message });
  }
});

// READ - Return all projects
router.get('/projects', async (req, res) => {
  try {
    const projects = await Project.find();
    res.json(projects);
  } catch (err) {
    console.error('Error fetching projects:', err);
    res.status(500).json({ error: err.message });
  }
});

// READ - Return a single project by ID
router.get('/projects/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  } catch (err) {
    console.error('Error fetching project:', err);
    res.status(500).json({ error: err.message });
  }
});

// UPDATE - Project by ID
router.put('/projects/:id', async (req, res) => {
  try {
    const updatedProject = await Project.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedProject) return res.status(404).json({ error: 'Project not found' });
    res.json(updatedProject);
  } catch (err) {
    console.error('Error updating project:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE a project by ID
router.delete('/projects/:id', async (req, res) => {
  try {
    const deletedProject = await Project.findByIdAndDelete(req.params.id);
    if (!deletedProject) return res.status(404).json({ error: 'Project not found' });
    // Delete all tasks associated with the project
    await Task.deleteMany({ project: req.params.id });
    res.json({ message: 'Project and associated tasks deleted successfully' });
  } catch (err) {
    console.error('Error deleting project:', err);
    res.status(500).json({ error: err.message });
  }
});


// CREATE a new task with project id validation
router.post('/tasks', async (req, res) => {
  try {
    const { project, name, description, duration, startDate, endDate } = req.body;
    
    // Validate the project id 
    if (!mongoose.Types.ObjectId.isValid(project)) {
      return res.status(400).json({ error: 'Invalid project id' });
    }
    
    // Check that the project exists
    const parentProject = await Project.findById(project);
    if (!parentProject) {
      return res.status(404).json({ error: 'Parent project not found' });
    }
    
    const task = new Task({ project, name, description, duration, startDate, endDate });
    const savedTask = await task.save();
    res.status(201).json(savedTask);
  } catch (err) {
    console.error('Error creating task:', err);
    res.status(500).json({ error: err.message });
  }
});

// READ all tasks
router.get('/tasks', async (req, res) => {
  try {
    const filter = {};
    if (req.query.project) {
      filter.project = req.query.project;
    }
    const tasks = await Task.find(filter).populate('project', 'name');
    res.json(tasks);
  } catch (err) {
    console.error('Error fetching tasks:', err);
    res.status(500).json({ error: err.message });
  }
});

// READ - Return a single task by ID
router.get('/tasks/:id', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).populate('project', 'name');
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) {
    console.error('Error fetching task:', err);
    res.status(500).json({ error: err.message });
  }
});

// UPDATE - Single task by ID
router.put('/tasks/:id', async (req, res) => {
  try {
    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedTask) return res.status(404).json({ error: 'Task not found' });
    res.json(updatedTask);
  } catch (err) {
    console.error('Error updating task:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE - Single task by ID
router.delete('/tasks/:id', async (req, res) => {
  try {
    const deletedTask = await Task.findByIdAndDelete(req.params.id);
    if (!deletedTask) return res.status(404).json({ error: 'Task not found' });
    res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    console.error('Error deleting task:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;