import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { FlowsService } from './flows.service';
import { FlowsRepository } from './flows.repository';
import { FlowStatus } from '../database/entities/flow.entity';
import { CreateFlowDto } from './dto/create-flow.dto';

const mockFlowsRepository = {
  create: jest.fn(),
  findById: jest.fn(),
  findByName: jest.fn(),
  findMany: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

describe('FlowsService', () => {
  let service: FlowsService;
  let repository: FlowsRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FlowsService,
        {
          provide: FlowsRepository,
          useValue: mockFlowsRepository,
        },
        {
          provide: 'WINSTON_MODULE_PROVIDER',
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<FlowsService>(FlowsService);
    repository = module.get<FlowsRepository>(FlowsRepository);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createFlow', () => {
    const createFlowDto: CreateFlowDto = {
      name: 'Test Flow',
      description: 'Test Description',
      nodes: [
        {
          id: 'node-1',
          type: 'test-node',
          version: '1.0.0',
          config: {},
          position: { x: 100, y: 100 },
        },
      ],
      connections: [],
    };

    it('should create a flow successfully', async () => {
      const mockFlow = {
        id: '123',
        ...createFlowDto,
        status: FlowStatus.DRAFT,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFlowsRepository.findByName.mockResolvedValue(null);
      mockFlowsRepository.create.mockResolvedValue(mockFlow);

      const result = await service.createFlow(createFlowDto);

      expect(mockFlowsRepository.findByName).toHaveBeenCalledWith(createFlowDto.name);
      expect(mockFlowsRepository.create).toHaveBeenCalledWith({
        ...createFlowDto,
        status: FlowStatus.DRAFT,
        version: 1,
      });
      expect(result.name).toBe(createFlowDto.name);
      expect(result.status).toBe(FlowStatus.DRAFT);
    });

    it('should throw ConflictException if flow name already exists', async () => {
      const existingFlow = { id: '123', name: createFlowDto.name };
      mockFlowsRepository.findByName.mockResolvedValue(existingFlow);

      await expect(service.createFlow(createFlowDto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockFlowsRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('getFlowById', () => {
    it('should return a flow by id', async () => {
      const mockFlow = {
        id: '123',
        name: 'Test Flow',
        status: FlowStatus.DRAFT,
        nodes: [],
        connections: [],
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFlowsRepository.findById.mockResolvedValue(mockFlow);

      const result = await service.getFlowById('123');

      expect(mockFlowsRepository.findById).toHaveBeenCalledWith('123');
      expect(result.id).toBe('123');
      expect(result.name).toBe('Test Flow');
    });

    it('should throw NotFoundException if flow not found', async () => {
      mockFlowsRepository.findById.mockResolvedValue(null);

      await expect(service.getFlowById('123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('validateFlow', () => {
    it('should validate flow with no errors', async () => {
      const flowData = {
        nodes: [
          {
            id: 'node-1',
            type: 'test-node',
            version: '1.0.0',
            config: {},
            position: { x: 100, y: 100 },
          },
        ],
        connections: [],
      };

      const result = await service.validateFlow(flowData);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for empty nodes', async () => {
      const flowData = {
        nodes: [],
        connections: [],
      };

      const result = await service.validateFlow(flowData);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('NO_NODES');
    });

    it('should return errors for invalid connections', async () => {
      const flowData = {
        nodes: [
          {
            id: 'node-1',
            type: 'test-node',
            version: '1.0.0',
            config: {},
            position: { x: 100, y: 100 },
          },
        ],
        connections: [
          {
            fromNodeId: 'node-1',
            fromOutput: 'output',
            toNodeId: 'node-2', // This node doesn't exist
            toInput: 'input',
          },
        ],
      };

      const result = await service.validateFlow(flowData);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].code).toBe('INVALID_CONNECTION');
    });
  });

  describe('deleteFlow', () => {
    it('should delete flow successfully', async () => {
      const mockFlow = {
        id: '123',
        name: 'Test Flow',
        schedules: [],
      };

      mockFlowsRepository.findById.mockResolvedValue(mockFlow);
      mockFlowsRepository.delete.mockResolvedValue(true);

      await service.deleteFlow('123');

      expect(mockFlowsRepository.findById).toHaveBeenCalledWith('123');
      expect(mockFlowsRepository.delete).toHaveBeenCalledWith('123');
    });

    it('should throw ConflictException if flow has active schedules', async () => {
      const mockFlow = {
        id: '123',
        name: 'Test Flow',
        schedules: [{ enabled: true }],
      };

      mockFlowsRepository.findById.mockResolvedValue(mockFlow);

      await expect(service.deleteFlow('123')).rejects.toThrow(
        ConflictException,
      );
      expect(mockFlowsRepository.delete).not.toHaveBeenCalled();
    });
  });
});