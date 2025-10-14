import express, { Request, Response } from 'express';

const router = express.Router();

// In-memory storage (replace with database in production)
let drivers: any[] = [];

// GET all drivers
router.get('/', (req: Request, res: Response) => {
  res.json({ success: true, data: drivers });
});

// GET driver by ID
router.get('/:id', (req: Request, res: Response) => {
  const driver = drivers.find(d => d.id === req.params.id);
  if (!driver) {
    return res.status(404).json({ success: false, error: 'Driver not found' });
  }
  res.json({ success: true, data: driver });
});

// POST create new driver
router.post('/', (req: Request, res: Response) => {
  const newDriver = {
    ...req.body,
    id: req.body.id || `driver-${Date.now()}`
  };
  drivers.push(newDriver);
  res.status(201).json({ success: true, data: newDriver });
});

// PUT update driver
router.put('/:id', (req: Request, res: Response) => {
  const index = drivers.findIndex(d => d.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Driver not found' });
  }
  drivers[index] = {
    ...drivers[index],
    ...req.body
  };
  res.json({ success: true, data: drivers[index] });
});

// DELETE driver
router.delete('/:id', (req: Request, res: Response) => {
  const index = drivers.findIndex(d => d.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Driver not found' });
  }
  const deleted = drivers.splice(index, 1);
  res.json({ success: true, data: deleted[0] });
});

export default router;
