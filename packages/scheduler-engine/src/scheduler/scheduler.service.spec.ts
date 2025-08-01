import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bull';
import { SchedulerService } from './scheduler.service';
import { ScheduleRepository } from './schedule.repository';
import { ExecutionRepository } from './execution.repository';
import { FlowsService } from '../flows/flows.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';

const mockScheduleRepository = {
  create: jest.fn(),
  findById: jest.fn(),
  findMany: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findSchedulesDueForExecution: jest.fn(),
  updateLastRun: jest.fn(),
};

const mockExecutionRepository = {
  create: jest.fn(),
  findById: jest.fn(),
  findMany: jest.fn(),
  update: jest.fn(),
};

const mockFlowsService = {
  getFlowById: jest.fn(),
};

const mockQueue = {
  add: jest.fn(),
  getJobs: jest.fn(),
  getJobCounts: jest.fn(),
};

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

describe('SchedulerService', () => {
  let service: SchedulerService;
  let scheduleRepository: ScheduleRepository;
  let flowsService: FlowsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulerService,
        {
          provide: ScheduleRepository,
          useValue: mockScheduleRepository,
        },
        {
          provide: ExecutionRepository,
          useValue: mockExecutionRepository,
        },
        {
          provide: FlowsService,
          useValue: mockFlowsService,
        },
        {
          provide: getQueueToken('flow-execution'),
          useValue: mockQueue,
        },
        {
          provide: 'WINSTON_MODULE_PROVIDER',
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<SchedulerService>(SchedulerService);
    scheduleRepository = module.get<ScheduleRepository>(ScheduleRepository);
    flowsService = module.get<FlowsService>(FlowsService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSchedule', () => {
    const createScheduleDto: CreateScheduleDto = {
      flowId: 'flow-123',
      name: 'Test Schedule',
      description: 'Test schedule description',
      cronExpression: '0 9 * * 1-5',
      timezone: 'UTC',
      enabled: true,
    };

    it('should create a schedule successfully', async () => {
      const mockFlow = { id: 'flow-123', name: 'Test Flow' };
      const mockSchedule = {
        id: 'schedule-123',
        ...createScheduleDto,
        nextRun: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFlowsService.getFlowById.mockResolvedValue(mockFlow);
      mockScheduleRepository.create.mockResolvedValue(mockSchedule);

      const result = await service.createSchedule(createScheduleDto);

      expect(mockFlowsService.getFlowById).toHaveBeenCalledWith(createScheduleDto.flowId);
      expect(mockScheduleRepository.create).toHaveBeenCalled();
      expect(result.name).toBe(createScheduleDto.name);
      expect(result.enabled).toBe(true);
    });

    it('should throw NotFoundException if flow does not exist', async () => {
      mockFlowsService.getFlowById.mockRejectedValue(new NotFoundException('Flow not found'));

      await expect(service.createSchedule(createScheduleDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockScheduleRepository.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid cron expression', async () => {
      const invalidDto = {
        ...createScheduleDto,
        cronExpression: 'invalid-cron',
      };

      mockFlowsService.getFlowById.mockResolvedValue({ id: 'flow-123' });

      await expect(service.createSchedule(invalidDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getScheduleById', () => {
    it('should return a schedule by id', async () => {
      const mockSchedule = {
        id: 'schedule-123',
        name: 'Test Schedule',
        cronExpression: '0 9 * * 1-5',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockScheduleRepository.findById.mockResolvedValue(mockSchedule);

      const result = await service.getScheduleById('schedule-123');

      expect(mockScheduleRepository.findById).toHaveBeenCalledWith('schedule-123');
      expect(result.id).toBe('schedule-123');
      expect(result.name).toBe('Test Schedule');
    });

    it('should throw NotFoundException if schedule not found', async () => {
      mockScheduleRepository.findById.mockResolvedValue(null);

      await expect(service.getScheduleById('schedule-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('enableSchedule', () => {
    it('should enable a schedule', async () => {
      const mockSchedule = {
        id: 'schedule-123',
        name: 'Test Schedule',
        enabled: false,
      };

      const updatedSchedule = {
        ...mockSchedule,
        enabled: true,
      };

      mockScheduleRepository.findById.mockResolvedValue(mockSchedule);
      mockScheduleRepository.update.mockResolvedValue(updatedSchedule);

      const result = await service.enableSchedule('schedule-123');

      expect(mockScheduleRepository.update).toHaveBeenCalledWith('schedule-123', {
        enabled: true,
      });
      expect(result.enabled).toBe(true);
    });
  });

  describe('getJobStats', () => {
    it('should return job queue statistics', async () => {
      const mockStats = {
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
        delayed: 1,
        paused: 0,
      };

      mockQueue.getJobCounts.mockResolvedValue(mockStats);

      const result = await service.getJobStats();

      expect(mockQueue.getJobCounts).toHaveBeenCalled();
      expect(result).toEqual(mockStats);
    });
  });
});