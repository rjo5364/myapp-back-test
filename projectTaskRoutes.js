const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const Schema = mongoose.Schema;

// MongoDB Schema for Projects
const projectSchema = new Schema({
  name: { type: String, required: true },
  description: String,
  startDate: Date,
  endDate: Date,
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }  // Reference to User's _id
}, { timestamps: true });

const Project = mongoose.model('Project', projectSchema);

// MongoDB Schema for Tasks
const taskSchema = new Schema({
  project: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  name: { type: String, required: true },
  description: String,
  duration: Number,
  startDate: Date,
  endDate: Date,
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }  // Reference to User's _id
}, { timestamps: true });

const Task = mongoose.model('Task', taskSchema);


// CREATE a new project (with owner linked to authenticated user)
router.post('/projects', async (req, res) => {
  try {
    const project = new Project({
      ...req.body,
      owner: req.user._id  // Attach the logged-in user's _id as the project owner
    });
    const savedProject = await project.save();
    res.status(201).json(savedProject);
  } catch (err) {
    console.error('Error creating project:', err);
    res.status(500).json({ error: err.message });
  }
});

// READ - Return all projects (filter by owner if user is authenticated, otherwise return all)
router.get('/projects', async (req, res) => {
  try {
    const filter = req.user ? { owner: req.user._id } : {};  // If user is authenticated, filter by owner
    const projects = await Project.find(filter);
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

// UPDATE - Project by ID (only if it belongs to the logged-in user)
router.put('/projects/:id', async (req, res) => {
  try {
    const updatedProject = await Project.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },  // Ensure the project belongs to the user
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedProject) return res.status(404).json({ error: 'Project not found or you do not own this project' });
    res.json(updatedProject);
  } catch (err) {
    console.error('Error updating project:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE a project by ID (only if it belongs to the logged-in user)
router.delete('/projects/:id', async (req, res) => {
  try {
    const deletedProject = await Project.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
    if (!deletedProject) return res.status(404).json({ error: 'Project not found or you do not own this project' });
    await Task.deleteMany({ project: req.params.id });
    res.json({ message: 'Project and associated tasks deleted successfully' });
  } catch (err) {
    console.error('Error deleting project:', err);
    res.status(500).json({ error: err.message });
  }
});


// CREATE a new task with project ID and owner (linked to authenticated user)
router.post('/tasks', async (req, res) => {
  try {
    const { project, name, description, duration, startDate, endDate } = req.body;

    if (!mongoose.Types.ObjectId.isValid(project)) {
      return res.status(400).json({ error: 'Invalid project id' });
    }

    // Check if the project belongs to the logged-in user
    const parentProject = await Project.findOne({ _id: project, owner: req.user._id });
    if (!parentProject) {
      return res.status(404).json({ error: 'Parent project not found or you do not own this project' });
    }

    const task = new Task({
      project,
      name,
      description,
      duration,
      startDate,
      endDate,
      owner: req.user._id  // Attach logged-in user's _id as the task owner
    });

    const savedTask = await task.save();
    res.status(201).json(savedTask);
  } catch (err) {
    console.error('Error creating task:', err);
    res.status(500).json({ error: err.message });
  }
});

// READ all tasks (filter by owner if user is authenticated, otherwise return all tasks)
router.get('/tasks', async (req, res) => {
  try {
    const filter = req.user ? { owner: req.user._id } : {};  // If user is authenticated, filter by owner
    if (req.query.project) {
      filter.project = req.query.project;  // Optional: filter by project ID
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
    const task = await Task.findOne({ _id: req.params.id, owner: req.user._id }).populate('project', 'name');
    if (!task) return res.status(404).json({ error: 'Task not found or you do not own this task' });
    res.json(task);
  } catch (err) {
    console.error('Error fetching task:', err);
    res.status(500).json({ error: err.message });
  }
});

// UPDATE - Single task by ID (only if it belongs to the logged-in user)
router.put('/tasks/:id', async (req, res) => {
  try {
    const updatedTask = await Task.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },  // Ensure the task belongs to the user
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedTask) return res.status(404).json({ error: 'Task not found or you do not own this task' });
    res.json(updatedTask);
  } catch (err) {
    console.error('Error updating task:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE - Single task by ID (only if it belongs to the logged-in user)
router.delete('/tasks/:id', async (req, res) => {
  try {
    const deletedTask = await Task.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
    if (!deletedTask) return res.status(404).json({ error: 'Task not found or you do not own this task' });
    res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    console.error('Error deleting task:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
