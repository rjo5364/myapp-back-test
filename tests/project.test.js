require('dotenv').config();
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;


const request = require('supertest');

// Use environment variables for IDs
const MOCK_USER_ID = new ObjectId(process.env.USER_ID || '67a61f1848cf44366dc1a5b6');
const PROJECT_ID = process.env.PROJECT_ID;
const TASK_ID = process.env.TASK_ID;

// Mock passport before requiring app
jest.mock('passport', () => ({
  initialize: () => (req, res, next) => {
    req.user = {
      _id: MOCK_USER_ID,
      name: process.env.MOCK_NAME,
      email: process.env.MOCK_EMAIL,
    };
    req.isAuthenticated = () => true;
    next();
  },
  session: () => (req, res, next) => next(),
  authenticate: () => (req, res, next) => next(),
  use: jest.fn(),
  serializeUser: jest.fn(),
  deserializeUser: jest.fn()
}));

// Import app after mock setup
const app = require('../index.js');

describe('Project API Tests', () => {
  // Connect to MongoDB before tests
  beforeAll(async () => {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('Test database connected');
    } catch (error) {
      console.error('Database connection error:', error);
      throw error;
    }
  });

  // Clean up after all tests
  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
  });

    

  describe('Project Tests', () => {
    // Basic Creation Tests
    it('should create a new project', async () => {
      //setting up mock project data
      const testProject = {
        name: 'Test Project',
        description: 'Test Description',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString()
      };
 
      const response = await request(app)
        .post('/api/projects')
        .send(testProject)
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json');
 
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('_id');
      expect(response.body.name).toBe(testProject.name);
      expect(response.body.description).toBe(testProject.description);
    });
 //project creation with only req fileds
    it('should handle project creation with only required fields', async () => {
      const testProject = {
        name: 'Minimal Project'
      };
 
      const response = await request(app)
        .post('/api/projects')
        .send(testProject)
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json');
 
      expect(response.status).toBe(201);
      expect(response.body.name).toBe(testProject.name);
    });
 //incomplete project data case
    it('should handle missing project description', async () => {
      const testProject = {
        name: 'No Description Project',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString()
      };
 
      const response = await request(app)
        .post('/api/projects')
        .send(testProject)
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json');
 
      expect(response.status).toBe(201);
      expect(response.body.description).toBeUndefined();
    });
 
    //required field missing for project case
    it('should return error if project name is missing', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({ description: 'Missing Name' })
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json');
 
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Project name is required');
    });
 //invalid data format case
    it('should handle invalid date formats for project creation', async () => {
      const testProject = {
        name: 'Invalid Date Project',
        description: 'Test Description',
        startDate: 'invalid-date',
        endDate: 'invalid-date'
      };
 
      const response = await request(app)
        .post('/api/projects')
        .send(testProject)
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json');
 
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
 
    // queries all projects case
    it('should return a list of projects', async () => {
      const response = await request(app)
        .get('/api/projects')
        .set('Accept', 'application/json');
 
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
 //query projects by project case
    it('should return a single project by ID', async () => {
      console.log('Fetching project with ID:', PROJECT_ID);
      console.log('Using user ID:', MOCK_USER_ID.toString());
      
      const response = await request(app)
        .get(`/api/projects/${PROJECT_ID}`)
        .set('Accept', 'application/json');
 
      console.log('Get project response:', response.body);
      
      expect(response.status).toBe(200);
      expect(response.body._id).toBe(PROJECT_ID);
    });
 //invalid project ID format case
    it('should handle invalid project ID format in URL', async () => {
      const response = await request(app)
        .get('/api/projects/invalid-id-format')
        .set('Accept', 'application/json');
 
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
 
    // Update a project case
    it('should update a project', async () => {
      const updateData = {
        name: 'Updated Project',
        description: 'Updated Description'
      };
 
      console.log('Updating project with ID:', PROJECT_ID);
      
      const response = await request(app)
        .put(`/api/projects/${PROJECT_ID}`)
        .send(updateData)
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json');
 
      console.log('Update project response:', response.body);
      
      expect(response.status).toBe(200);
      expect(response.body.name).toBe(updateData.name);
      expect(response.body.description).toBe(updateData.description);
    });
 //parital data update case
    it('should handle project update with partial data', async () => {
      const updateData = {
        name: 'Partially Updated Project'
      };
 
      const response = await request(app)
        .put(`/api/projects/${PROJECT_ID}`)
        .send(updateData)
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json');
 
      expect(response.status).toBe(200);
      expect(response.body.name).toBe(updateData.name);
      expect(response.body).toHaveProperty('description');
    });
  });


  describe('Task Tests', () => {
// Create a new task case
    it('should create a new task', async () => {
      const testTask = {
        project: process.env.PROJECT_ID, 
        name: 'Test Task',
        description: 'Task for testing',
        duration: 2,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString()
      };

      console.log('Creating task for project:', process.env.PROJECT_ID);

      const response = await request(app)
        .post('/api/tasks')
        .send(testTask)
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json');

      console.log('Task creation response:', response.body);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('_id');
      taskId = response.body._id;
    });
//get all tasks case
    it('should get all tasks', async () => {
      const response = await request(app)
        .get('/api/tasks')
        .set('Accept', 'application/json');

      console.log('Get all tasks response:', response.body);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });


    // Get a single task case
    it('should get a single task', async () => {
      console.log('Fetching task with ID:', taskId);

      const response = await request(app)
        .get(`/api/tasks/${taskId}`)
        .set('Accept', 'application/json');

      console.log('Get single task response:', response.body);

      expect(response.status).toBe(200);
      expect(response.body._id).toBe(taskId);
    });

    // Update a task case complete
    it('should update a task', async () => {
      const updateData = {
        name: 'Updated Task',
        description: 'Updated Task Description'
      };

      console.log('Updating task with ID:', taskId);

      const response = await request(app)
        .put(`/api/tasks/${taskId}`)
        .send(updateData)
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json');

      console.log('Update task response:', response.body);

      expect(response.status).toBe(200);
      expect(response.body.name).toBe(updateData.name);
      expect(response.body.description).toBe(updateData.description);
    });

    //task creation with only req fields
    it('should handle task creation with minimal fields', async () => {
      const testTask = {
        project: process.env.PROJECT_ID,
        name: 'Minimal Task'
      };
    
      const response = await request(app)
        .post('/api/tasks')
        .send(testTask)
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json');
    
      expect(response.status).toBe(201);
      expect(response.body.name).toBe(testTask.name);
    });
    //update task data partially case
    it('should handle task update with only name change', async () => {
      const updateData = {
        name: 'Simple Name Update'
      };
    
      const response = await request(app)
        .put(`/api/tasks/${TASK_ID}`)
        .send(updateData)
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json');
    
      expect(response.status).toBe(200);
      expect(response.body.name).toBe(updateData.name);
    });
    
    //empty description case
    it('should handle empty description in task creation', async () => {
      const testTask = {
        project: process.env.PROJECT_ID,
        name: 'No Description Task',
        description: ''
      };
    
      const response = await request(app)
        .post('/api/tasks')
        .send(testTask)
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json');
    
      expect(response.status).toBe(201);
      expect(response.body.description).toBe('');
    });    

    //update task data partially case
    it('should handle task update with only duration change', async () => {
      const updateData = {
        duration: 5
      };
    
      const response = await request(app)
        .put(`/api/tasks/${TASK_ID}`)
        .send(updateData)
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json');
    
      expect(response.status).toBe(200);
      expect(response.body.duration).toBe(updateData.duration);
    });
    //aggregate count of tasks
    it('should return the correct count of tasks for a project', async () => {
      const projectTasks = await request(app)
        .get(`/api/tasks?project=${PROJECT_ID}`)
        .set('Accept', 'application/json');
    
      const allTasks = await request(app)
        .get('/api/tasks')
        .set('Accept', 'application/json');
    
      expect(projectTasks.status).toBe(200);
      expect(Array.isArray(projectTasks.body)).toBe(true);
      expect(projectTasks.body.length).toBeLessThanOrEqual(allTasks.body.length);
    });

    //delete a task case
    it('should delete a task', async () => {
      console.log('Deleting task with ID:', taskId);

      const response = await request(app)
        .delete(`/api/tasks/${taskId}`)
        .set('Accept', 'application/json');

      console.log('Delete task response:', response.body);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Task deleted successfully');
    });
});

// delete all projects and related tasks case
it('should delete a project and its tasks', async () => {
    const response = await request(app)
      .delete(`/api/projects/${process.env.PROJECT_ID}`)
      .set('Accept', 'application/json');

    console.log('Delete project response:', response.body);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Project and associated tasks deleted successfully');
});
});