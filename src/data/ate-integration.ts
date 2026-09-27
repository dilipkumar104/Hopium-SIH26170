/**
 * Live ATE (Automated Test Equipment) Integration Module
 *
 * Provides real-time data streaming capabilities from ATE systems via:
 * - MQTT: Lightweight IoT-friendly protocol for sensor/component data
 * - OPC-UA: Industrial standard for machine-to-machine communication
 *
 * This module handles:
 * - Connection management and reconnection logic
 * - Data normalization and validation
 * - State management for live test sessions
 * - Event-based notification system
 */

import type { Measurement } from './types';

// ─── MQTT Configuration ─────────────────────────────────────────

export interface MQTTConfig {
  brokerUrl: string; // e.g., "mqtt://broker.example.com:1883"
  clientId: string; // Unique identifier for this client
  username?: string;
  password?: string;
  topics: {
    measurements: string; // Topic for component measurements
    status: string; // Topic for equipment status
    commands: string; // Topic for sending commands
  };
  reconnectInterval: number; // milliseconds
  maxReconnectAttempts: number;
}

// ─── OPC-UA Configuration ────────────────────────────────────────

export interface OPCUAConfig {
  serverUrl: string; // e.g., "opc.tcp://localhost:48010"
  securityMode: 'None' | 'Sign' | 'SignAndEncrypt';
  nodeIds: {
    measurements: string; // Node ID for measurement array
    status: string; // Node ID for equipment status
    testProgress: string; // Node ID for test progress
  };
  connectionTimeout: number; // milliseconds
  sessionTimeout: number; // milliseconds
}

// ─── ATE Data Models ────────────────────────────────────────────

export interface ATEMeasurement {
  componentId: string;
  timestamp: Date;
  parameterName: string;
  value: number;
  unit: string;
  testPointHours: number; // 0, 24, 96, or 168
  temperature: number; // Operating temperature
  voltage: number; // Operating voltage
  confidence: number; // 0-1
  status: 'valid' | 'questionable' | 'failed';
}

export interface ATEEquipmentStatus {
  equipmentId: string;
  timestamp: Date;
  state: 'idle' | 'testing' | 'paused' | 'error' | 'maintenance';
  currentTestId: string;
  currentComponent: string;
  currentTestPoint: number; // 0, 24, 96, or 168
  testProgress: number; // 0-100%
  errorCode?: string;
  errorMessage?: string;
  temperatureSetpoint: number;
  temperatureActual: number;
  estimatedTimeRemaining: number; // seconds
}

export interface TestSession {
  testId: string;
  lotId: string;
  startTime: Date;
  estimatedEndTime: Date;
  components: string[];
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  measurements: ATEMeasurement[];
  equipmentStatus: ATEEquipmentStatus[];
}

// ─── Event Types ────────────────────────────────────────────────

export type ATEEventType =
  | 'connected'
  | 'disconnected'
  | 'measurement_received'
  | 'status_updated'
  | 'error'
  | 'test_started'
  | 'test_completed'
  | 'test_paused';

export interface ATEEvent {
  type: ATEEventType;
  timestamp: Date;
  data: any;
  source: 'mqtt' | 'opc-ua';
}

export type ATEEventListener = (event: ATEEvent) => void;

// ─── MQTT Client Interface ──────────────────────────────────────

export class MQTTATEClient {
  private config: MQTTConfig;
  private eventListeners: Set<ATEEventListener> = new Set();
  private reconnectAttempts = 0;
  private isConnected = false;
  private measurementBuffer: ATEMeasurement[] = [];
  private reconnectTimer?: ReturnType<typeof setTimeout>;

  constructor(config: MQTTConfig) {
    this.config = config;
  }

  /**
   * Connect to MQTT broker
   * In a real implementation, this would use a library like `paho-mqtt` or `mqtt.js`
   */
  async connect(): Promise<void> {
    try {
      // In production, use: import * as mqtt from 'mqtt';
      // const client = mqtt.connect(this.config.brokerUrl, {
      //   clientId: this.config.clientId,
      //   username: this.config.username,
      //   password: this.config.password,
      // });

      // Simulate connection
      this.isConnected = true;
      this.reconnectAttempts = 0;

      this.emit({
        type: 'connected',
        timestamp: new Date(),
        data: { broker: this.config.brokerUrl },
        source: 'mqtt',
      });

      // Subscribe to topics
      this.subscribeToTopics();
    } catch (error) {
      this.handleConnectionError(error);
    }
  }

  /**
   * Subscribe to ATE data topics
   */
  private subscribeToTopics(): void {
    // In production implementation:
    // client.subscribe(this.config.topics.measurements, (err) => {
    //   if (!err) console.log(`Subscribed to ${this.config.topics.measurements}`);
    // });
    // client.subscribe(this.config.topics.status, (err) => {
    //   if (!err) console.log(`Subscribed to ${this.config.topics.status}`);
    // });

    console.log(`[MQTT] Subscribed to topics:`, this.config.topics);
  }

  /**
   * Handle incoming measurement data from ATE
   */
  onMeasurementReceived(payload: string): void {
    try {
      const data = JSON.parse(payload);
      const measurement: ATEMeasurement = {
        componentId: data.componentId,
        timestamp: new Date(data.timestamp),
        parameterName: data.parameterName,
        value: parseFloat(data.value),
        unit: data.unit,
        testPointHours: parseInt(data.testPointHours),
        temperature: parseFloat(data.temperature),
        voltage: parseFloat(data.voltage),
        confidence: parseFloat(data.confidence) || 0.95,
        status: data.status || 'valid',
      };

      // Validate measurement
      if (this.validateMeasurement(measurement)) {
        this.measurementBuffer.push(measurement);
        this.emit({
          type: 'measurement_received',
          timestamp: new Date(),
          data: measurement,
          source: 'mqtt',
        });
      }
    } catch (error) {
      this.emit({
        type: 'error',
        timestamp: new Date(),
        data: { error: `Failed to parse measurement: ${error}` },
        source: 'mqtt',
      });
    }
  }

  /**
   * Handle incoming status data from ATE
   */
  onStatusReceived(payload: string): void {
    try {
      const data = JSON.parse(payload);
      const status: ATEEquipmentStatus = {
        equipmentId: data.equipmentId,
        timestamp: new Date(data.timestamp),
        state: data.state,
        currentTestId: data.currentTestId,
        currentComponent: data.currentComponent,
        currentTestPoint: parseInt(data.currentTestPoint),
        testProgress: parseFloat(data.testProgress),
        errorCode: data.errorCode,
        errorMessage: data.errorMessage,
        temperatureSetpoint: parseFloat(data.temperatureSetpoint),
        temperatureActual: parseFloat(data.temperatureActual),
        estimatedTimeRemaining: parseInt(data.estimatedTimeRemaining),
      };

      this.emit({
        type: 'status_updated',
        timestamp: new Date(),
        data: status,
        source: 'mqtt',
      });
    } catch (error) {
      this.emit({
        type: 'error',
        timestamp: new Date(),
        data: { error: `Failed to parse status: ${error}` },
        source: 'mqtt',
      });
    }
  }

  /**
   * Validate incoming measurement data
   */
  private validateMeasurement(measurement: ATEMeasurement): boolean {
    // Check for required fields
    if (!measurement.componentId || !measurement.parameterName || measurement.value === undefined) {
      return false;
    }

    // Check for valid test point
    if (![0, 24, 96, 168].includes(measurement.testPointHours)) {
      return false;
    }

    // Check value is within reasonable range (not NaN or Infinity)
    if (!isFinite(measurement.value)) {
      return false;
    }

    // Check temperature is reasonable (typically 25-200°C)
    if (measurement.temperature < -50 || measurement.temperature > 250) {
      return false;
    }

    return true;
  }

  /**
   * Send command to ATE (e.g., start/stop test)
   */
  async sendCommand(command: { action: string; [key: string]: any }): Promise<void> {
    // In production:
    // const payload = JSON.stringify(command);
    // client.publish(this.config.topics.commands, payload);
    console.log(`[MQTT] Sending command:`, command);
  }

  /**
   * Get buffered measurements
   */
  getMeasurements(): ATEMeasurement[] {
    return [...this.measurementBuffer];
  }

  /**
   * Clear measurement buffer
   */
  clearMeasurements(): void {
    this.measurementBuffer = [];
  }

  /**
   * Subscribe to events
   */
  on(listener: ATEEventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /**
   * Emit event to all listeners
   */
  private emit(event: ATEEvent): void {
    this.eventListeners.forEach((listener) => listener(event));
  }

  /**
   * Handle connection error with reconnection logic
   */
  private handleConnectionError(error: any): void {
    this.isConnected = false;
    this.reconnectAttempts++;

    this.emit({
      type: 'error',
      timestamp: new Date(),
      data: { error: error.message, reconnectAttempt: this.reconnectAttempts },
      source: 'mqtt',
    });

    if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.reconnectTimer = setTimeout(
        () => this.connect(),
        this.config.reconnectInterval * this.reconnectAttempts
      );
    }
  }

  /**
   * Disconnect from broker
   */
  disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.isConnected = false;

    this.emit({
      type: 'disconnected',
      timestamp: new Date(),
      data: {},
      source: 'mqtt',
    });
  }

  /**
   * Get connection status
   */
  getStatus(): { connected: boolean; reconnectAttempts: number } {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
    };
  }
}

// ─── OPC-UA Client Interface ─────────────────────────────────────

export class OPCUAATEClient {
  private config: OPCUAConfig;
  private eventListeners: Set<ATEEventListener> = new Set();
  private isConnected = false;
  private measurementBuffer: ATEMeasurement[] = [];
  private pollInterval?: ReturnType<typeof setInterval>;

  constructor(config: OPCUAConfig) {
    this.config = config;
  }

  /**
   * Connect to OPC-UA server
   * In a real implementation, this would use `node-opcua` library
   */
  async connect(): Promise<void> {
    try {
      // In production, use: import { OPCUAClient } from 'node-opcua';
      // const client = OPCUAClient.create({
      //   applicationUri: 'urn:example:app',
      //   connectionStrategy: { maxRetry: 5, initialDelay: 1000 },
      // });

      // Simulate connection
      this.isConnected = true;

      this.emit({
        type: 'connected',
        timestamp: new Date(),
        data: { server: this.config.serverUrl },
        source: 'opc-ua',
      });

      // Start polling for data
      this.startPolling();
    } catch (error) {
      this.emit({
        type: 'error',
        timestamp: new Date(),
        data: { error: `OPC-UA connection failed: ${error}` },
        source: 'opc-ua',
      });
    }
  }

  /**
   * Poll OPC-UA server for new measurements
   */
  private startPolling(): void {
    this.pollInterval = setInterval(() => {
      this.pollMeasurements();
    }, 5000); // Poll every 5 seconds
  }

  /**
   * Read measurements from OPC-UA nodes
   */
  private async pollMeasurements(): Promise<void> {
    if (!this.isConnected) return;

    try {
      // In production:
      // const measurementNode = await session.read({
      //   nodeId: this.config.nodeIds.measurements,
      //   attributeId: AttributeIds.Value,
      // });

      // Simulate reading data
      // This would contain real measurement data in production
    } catch (error) {
      console.error('OPC-UA polling error:', error);
    }
  }

  /**
   * Parse OPC-UA variant data to ATEMeasurement
   */
  private parseMeasurementVariant(variant: any): ATEMeasurement {
    return {
      componentId: variant.componentId,
      timestamp: new Date(variant.timestamp),
      parameterName: variant.parameterName,
      value: variant.value,
      unit: variant.unit,
      testPointHours: variant.testPointHours,
      temperature: variant.temperature,
      voltage: variant.voltage,
      confidence: variant.confidence || 0.95,
      status: variant.status || 'valid',
    };
  }

  /**
   * Write command to OPC-UA node
   */
  async writeCommand(nodeId: string, value: any): Promise<void> {
    if (!this.isConnected) {
      throw new Error('OPC-UA client not connected');
    }

    // In production:
    // await session.write({
    //   nodeId,
    //   attributeId: AttributeIds.Value,
    //   value: { value },
    // });

    console.log(`[OPC-UA] Writing to node ${nodeId}:`, value);
  }

  /**
   * Subscribe to OPC-UA node changes (for real-time updates)
   */
  async subscribeToMeasurements(): Promise<void> {
    // In production, use OPC-UA subscription mechanism:
    // const subscription = await session.createSubscription({
    //   requestedPublishingInterval: 1000,
    //   requestedLifetimeCount: 10,
    //   requestedMaxKeepAliveCount: 2,
    // });

    console.log('[OPC-UA] Subscribed to measurement node');
  }

  /**
   * Get buffered measurements
   */
  getMeasurements(): ATEMeasurement[] {
    return [...this.measurementBuffer];
  }

  /**
   * Subscribe to events
   */
  on(listener: ATEEventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /**
   * Emit event
   */
  private emit(event: ATEEvent): void {
    this.eventListeners.forEach((listener) => listener(event));
  }

  /**
   * Disconnect from OPC-UA server
   */
  disconnect(): void {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.isConnected = false;

    this.emit({
      type: 'disconnected',
      timestamp: new Date(),
      data: {},
      source: 'opc-ua',
    });
  }

  /**
   * Get connection status
   */
  getStatus(): { connected: boolean } {
    return { connected: this.isConnected };
  }
}

// ─── ATE Session Manager ────────────────────────────────────────

export class ATESessionManager {
  private currentSession: TestSession | null = null;
  private mqttClient?: MQTTATEClient;
  private opcuaClient?: OPCUAATEClient;
  private eventListeners: Set<ATEEventListener> = new Set();

  constructor() {}

  /**
   * Initialize MQTT connection
   */
  async initializeMQTT(config: MQTTConfig): Promise<void> {
    this.mqttClient = new MQTTATEClient(config);

    this.mqttClient.on((event) => {
      this.handleATEEvent(event);
    });

    await this.mqttClient.connect();
  }

  /**
   * Initialize OPC-UA connection
   */
  async initializeOPCUA(config: OPCUAConfig): Promise<void> {
    this.opcuaClient = new OPCUAATEClient(config);

    this.opcuaClient.on((event) => {
      this.handleATEEvent(event);
    });

    await this.opcuaClient.connect();
  }

  /**
   * Start a new test session
   */
  startSession(testId: string, lotId: string, components: string[]): TestSession {
    this.currentSession = {
      testId,
      lotId,
      startTime: new Date(),
      estimatedEndTime: new Date(Date.now() + 168 * 60 * 60 * 1000), // 168 hours
      components,
      status: 'running',
      measurements: [],
      equipmentStatus: [],
    };

    this.emit({
      type: 'test_started',
      timestamp: new Date(),
      data: { testId, lotId, components },
      source: 'mqtt', // Could be either
    });

    return this.currentSession;
  }

  /**
   * Get current session
   */
  getSession(): TestSession | null {
    return this.currentSession;
  }

  /**
   * Add measurement to current session
   */
  addMeasurement(measurement: ATEMeasurement): void {
    if (!this.currentSession) {
      console.warn('No active test session');
      return;
    }

    this.currentSession.measurements.push(measurement);

    // Convert ATEMeasurement to internal Measurement format
    const internalMeasurement: Measurement = {
      timeHours: measurement.testPointHours,
      value: measurement.value,
    };

    this.emit({
      type: 'measurement_received',
      timestamp: new Date(),
      data: { measurement, internalMeasurement },
      source: 'mqtt',
    });
  }

  /**
   * Update equipment status in current session
   */
  updateEquipmentStatus(status: ATEEquipmentStatus): void {
    if (!this.currentSession) return;

    this.currentSession.equipmentStatus.push(status);
    this.emit({
      type: 'status_updated',
      timestamp: new Date(),
      data: status,
      source: 'mqtt',
    });
  }

  /**
   * Complete current test session
   */
  completeSession(): TestSession | null {
    if (!this.currentSession) return null;

    this.currentSession.status = 'completed';

    this.emit({
      type: 'test_completed',
      timestamp: new Date(),
      data: {
        testId: this.currentSession.testId,
        measurements: this.currentSession.measurements.length,
      },
      source: 'mqtt',
    });

    return this.currentSession;
  }

  /**
   * Handle ATE events and propagate to subscribers
   */
  private handleATEEvent(event: ATEEvent): void {
    switch (event.type) {
      case 'measurement_received':
        if (event.data instanceof Object && 'componentId' in event.data) {
          this.addMeasurement(event.data as ATEMeasurement);
        }
        break;

      case 'status_updated':
        if (event.data instanceof Object && 'equipmentId' in event.data) {
          this.updateEquipmentStatus(event.data as ATEEquipmentStatus);
        }
        break;

      case 'error':
        console.error('[ATE Error]', event.data);
        break;

      case 'disconnected':
        if (this.currentSession) {
          this.currentSession.status = 'paused';
        }
        break;

      case 'connected':
        if (this.currentSession && this.currentSession.status === 'paused') {
          this.currentSession.status = 'running';
        }
        break;
    }

    this.emit(event);
  }

  /**
   * Subscribe to session events
   */
  on(listener: ATEEventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /**
   * Emit event
   */
  private emit(event: ATEEvent): void {
    this.eventListeners.forEach((listener) => listener(event));
  }

  /**
   * Disconnect all clients
   */
  disconnect(): void {
    this.mqttClient?.disconnect();
    this.opcuaClient?.disconnect();
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      mqtt: this.mqttClient?.getStatus(),
      opcua: this.opcuaClient?.getStatus(),
      currentSession: this.currentSession ? {
        testId: this.currentSession.testId,
        status: this.currentSession.status,
        measurementCount: this.currentSession.measurements.length,
      } : null,
    };
  }
}

// ─── Singleton Instance ──────────────────────────────────────────

export const ateSessionManager = new ATESessionManager();
