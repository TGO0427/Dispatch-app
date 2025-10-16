import express, { Request, Response } from 'express';
import prisma from '../db';

const router = express.Router();

// Helper to format job response (convert DateTime to ISO strings)
const formatJob = (job: any) => ({
  ...job,
  createdAt: job.createdAt.toISOString(),
  updatedAt: job.updatedAt.toISOString()
});

// GET all jobs
router.get('/', async (req: Request, res: Response) => {
  try {
    const jobs = await prisma.job.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: jobs.map(formatJob) });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch jobs' });
  }
});

// GET job by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id }
    });
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }
    res.json({ success: true, data: formatJob(job) });
  } catch (error) {
    console.error('Error fetching job:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch job' });
  }
});

// POST create new job
router.post('/', async (req: Request, res: Response) => {
  try {
    const newJob = await prisma.job.create({
      data: {
        ref: req.body.ref,
        customer: req.body.customer,
        pickup: req.body.pickup,
        dropoff: req.body.dropoff,
        warehouse: req.body.warehouse,
        priority: req.body.priority || 'normal',
        status: req.body.status || 'pending',
        pallets: req.body.pallets,
        outstandingQty: req.body.outstandingQty,
        eta: req.body.eta,
        scheduledAt: req.body.scheduledAt,
        actualDeliveryAt: req.body.actualDeliveryAt,
        exceptionReason: req.body.exceptionReason,
        driverId: req.body.driverId,
        notes: req.body.notes
      }
    });
    res.status(201).json({ success: true, data: formatJob(newJob) });
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).json({ success: false, error: 'Failed to create job' });
  }
});

// PUT update job
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const updatedJob = await prisma.job.update({
      where: { id: req.params.id },
      data: {
        ref: req.body.ref,
        customer: req.body.customer,
        pickup: req.body.pickup,
        dropoff: req.body.dropoff,
        warehouse: req.body.warehouse,
        priority: req.body.priority,
        status: req.body.status,
        pallets: req.body.pallets,
        outstandingQty: req.body.outstandingQty,
        eta: req.body.eta,
        scheduledAt: req.body.scheduledAt,
        actualDeliveryAt: req.body.actualDeliveryAt,
        exceptionReason: req.body.exceptionReason,
        driverId: req.body.driverId,
        notes: req.body.notes
      }
    });
    res.json({ success: true, data: formatJob(updatedJob) });
  } catch (error) {
    console.error('Error updating job:', error);
    if ((error as any).code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }
    res.status(500).json({ success: false, error: 'Failed to update job' });
  }
});

// DELETE job
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await prisma.job.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true, data: formatJob(deleted) });
  } catch (error) {
    console.error('Error deleting job:', error);
    if ((error as any).code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }
    res.status(500).json({ success: false, error: 'Failed to delete job' });
  }
});

// POST bulk create jobs
router.post('/bulk', async (req: Request, res: Response) => {
  try {
    const jobsData = req.body.jobs.map((job: any) => ({
      ref: job.ref,
      customer: job.customer,
      pickup: job.pickup,
      dropoff: job.dropoff,
      warehouse: job.warehouse,
      priority: job.priority || 'normal',
      status: job.status || 'pending',
      pallets: job.pallets,
      outstandingQty: job.outstandingQty,
      eta: job.eta,
      scheduledAt: job.scheduledAt,
      actualDeliveryAt: job.actualDeliveryAt,
      exceptionReason: job.exceptionReason,
      driverId: job.driverId,
      notes: job.notes
    }));

    const result = await prisma.job.createMany({
      data: jobsData
    });

    // Fetch the created jobs to return them
    const createdJobs = await prisma.job.findMany({
      orderBy: { createdAt: 'desc' },
      take: result.count
    });

    res.status(201).json({ success: true, data: createdJobs.map(formatJob) });
  } catch (error) {
    console.error('Error bulk creating jobs:', error);
    res.status(500).json({ success: false, error: 'Failed to bulk create jobs' });
  }
});

export default router;
