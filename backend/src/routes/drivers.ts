import express, { Request, Response } from 'express';
import prisma from '../db';

const router = express.Router();

// GET all drivers
router.get('/', async (req: Request, res: Response) => {
  try {
    const drivers = await prisma.driver.findMany({
      orderBy: { name: 'asc' }
    });
    res.json({ success: true, data: drivers });
  } catch (error) {
    console.error('Error fetching drivers:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch drivers' });
  }
});

// GET driver by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const driver = await prisma.driver.findUnique({
      where: { id: req.params.id },
      include: { jobs: true }
    });
    if (!driver) {
      return res.status(404).json({ success: false, error: 'Driver not found' });
    }
    res.json({ success: true, data: driver });
  } catch (error) {
    console.error('Error fetching driver:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch driver' });
  }
});

// POST create new driver
router.post('/', async (req: Request, res: Response) => {
  try {
    const newDriver = await prisma.driver.create({
      data: {
        name: req.body.name,
        callsign: req.body.callsign,
        location: req.body.location,
        capacity: req.body.capacity,
        assignedJobs: req.body.assignedJobs || 0,
        status: req.body.status || 'offline',
        phone: req.body.phone,
        email: req.body.email
      }
    });
    res.status(201).json({ success: true, data: newDriver });
  } catch (error) {
    console.error('Error creating driver:', error);
    if ((error as any).code === 'P2002') {
      return res.status(409).json({ success: false, error: 'Driver with this callsign already exists' });
    }
    res.status(500).json({ success: false, error: 'Failed to create driver' });
  }
});

// PUT update driver
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const updatedDriver = await prisma.driver.update({
      where: { id: req.params.id },
      data: {
        name: req.body.name,
        callsign: req.body.callsign,
        location: req.body.location,
        capacity: req.body.capacity,
        assignedJobs: req.body.assignedJobs,
        status: req.body.status,
        phone: req.body.phone,
        email: req.body.email
      }
    });
    res.json({ success: true, data: updatedDriver });
  } catch (error) {
    console.error('Error updating driver:', error);
    if ((error as any).code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Driver not found' });
    }
    if ((error as any).code === 'P2002') {
      return res.status(409).json({ success: false, error: 'Driver with this callsign already exists' });
    }
    res.status(500).json({ success: false, error: 'Failed to update driver' });
  }
});

// DELETE driver
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await prisma.driver.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true, data: deleted });
  } catch (error) {
    console.error('Error deleting driver:', error);
    if ((error as any).code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Driver not found' });
    }
    res.status(500).json({ success: false, error: 'Failed to delete driver' });
  }
});

export default router;
