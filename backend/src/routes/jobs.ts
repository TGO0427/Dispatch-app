import express, { Request, Response } from 'express';

const router = express.Router();

// In-memory storage (replace with database in production)
let jobs: any[] = [];

// GET all jobs
router.get('/', (req: Request, res: Response) => {
  res.json({ success: true, data: jobs });
});

// GET job by ID
router.get('/:id', (req: Request, res: Response) => {
  const job = jobs.find(j => j.id === req.params.id);
  if (!job) {
    return res.status(404).json({ success: false, error: 'Job not found' });
  }
  res.json({ success: true, data: job });
});

// POST create new job
router.post('/', (req: Request, res: Response) => {
  const newJob = {
    ...req.body,
    id: req.body.id || `job-${Date.now()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  jobs.push(newJob);
  res.status(201).json({ success: true, data: newJob });
});

// PUT update job
router.put('/:id', (req: Request, res: Response) => {
  const index = jobs.findIndex(j => j.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Job not found' });
  }
  jobs[index] = {
    ...jobs[index],
    ...req.body,
    updatedAt: new Date().toISOString()
  };
  res.json({ success: true, data: jobs[index] });
});

// DELETE job
router.delete('/:id', (req: Request, res: Response) => {
  const index = jobs.findIndex(j => j.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Job not found' });
  }
  const deleted = jobs.splice(index, 1);
  res.json({ success: true, data: deleted[0] });
});

// POST bulk create jobs
router.post('/bulk', (req: Request, res: Response) => {
  const newJobs = req.body.jobs.map((job: any) => ({
    ...job,
    id: job.id || `job-${Date.now()}-${Math.random()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));
  jobs = [...jobs, ...newJobs];
  res.status(201).json({ success: true, data: newJobs });
});

export default router;
