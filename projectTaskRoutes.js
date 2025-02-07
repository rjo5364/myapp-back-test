const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const Schema = mongoose.Schema;

//The application  manages projects and tasks using MongoDB Atlas as the database. 
// It defines two Mongoose schemas: Project and Task
// Each project and task is associated with a user (owner) via a reference to the User's _id.
//The id is important because on front end ui, this is the list for each schema is populated respectively
//If the ID param is not used such as in Postman, all entries are returned regardless of ID

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


// CREATE a new project 
router.post('/projects', async (req, res) => {
  try {
    const project = new Project({
      ...req.body,
      owner: req.user._id  
    });
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
    const filter = req.user ? { owner: req.user._id } : {};  
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

// UPDATE - Project by ID 
router.put('/projects/:id', async (req, res) => {
  try {
    const updatedProject = await Project.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },  
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


// CREATE a new task with project id and owner 
router.post('/tasks', async (req, res) => {
  try {
    const { project, name, description, duration, startDate, endDate } = req.body;

    if (!mongoose.Types.ObjectId.isValid(project)) {
      return res.status(400).json({ error: 'Invalid project id' });
    }

    // Checking if the project belongs to the logged-in user
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
      owner: req.user._id  
    });

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
    const filter = req.user ? { owner: req.user._id } : {};  
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
      { _id: req.params.id, owner: req.user._id }, 
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
