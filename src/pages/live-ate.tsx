import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ateSessionManager, type ATEEvent, type TestSession, type ATEEquipmentStatus } from '@/data/ate-integration';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface ConnectionStatus {
  mqtt?: { connected: boolean };
  opcua?: { connected: boolean };
  currentSession?: any;
}

export function LiveATEPage() {
  const [session, setSession] = useState<TestSession | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [measurements, setMeasurements] = useState<any[]>([]);
  const [latestStatus, setLatestStatus] = useState<ATEEquipmentStatus | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [useProtocol, setUseProtocol] = useState<'mqtt' | 'opc-ua'>('mqtt');

  useEffect(() => {
    // Subscribe to ATE events
    const unsubscribe = ateSessionManager.on((event: ATEEvent) => {
      switch (event.type) {
        case 'measurement_received':
          setMeasurements((prev) => [...prev, event.data]);
          break;

        case 'status_updated':
          setLatestStatus(event.data);
          const current = ateSessionManager.getSession();
          if (current) setSession(current);
          break;

        case 'connected':
          setConnectionStatus((prev: ConnectionStatus | null) => ({ ...prev, connected: true } as ConnectionStatus));
          break;

        case 'disconnected':
          setConnectionStatus((prev: ConnectionStatus | null) => ({ ...prev, connected: false } as ConnectionStatus));
          break;
      }
    });

    return unsubscribe;
  }, []);

  const handleInitializeConnection = async () => {
    setIsConnecting(true);

    try {
      if (useProtocol === 'mqtt') {
        await ateSessionManager.initializeMQTT({
          brokerUrl: 'mqtt://localhost:1883',
          clientId: `sih26170-client-${Date.now()}`,
          topics: {
            measurements: 'ate/measurements',
            status: 'ate/status',
            commands: 'ate/commands',
          },
          reconnectInterval: 1000,
          maxReconnectAttempts: 10,
        });
      } else {
        await ateSessionManager.initializeOPCUA({
          serverUrl: 'opc.tcp://localhost:48010',
          securityMode: 'None',
          nodeIds: {
            measurements: 'ns=2;s=Measurements',
            status: 'ns=2;s=Status',
            testProgress: 'ns=2;s=TestProgress',
          },
          connectionTimeout: 10000,
          sessionTimeout: 30000,
        });
      }

      setConnectionStatus(ateSessionManager.getStatus());
    } catch (error) {
      console.error('Failed to initialize connection:', error);
    }

    setIsConnecting(false);
  };

  const handleStartSession = () => {
    const testId = `TEST-${Date.now()}`;
    const newSession = ateSessionManager.startSession(testId, 'IGBT-2026-017', [
      'C201', 'C518', 'C742', 'C883', // Showcase components
    ]);
    setSession(newSession);
    setMeasurements([]);
  };

  const handleCompleteSession = () => {
    const completed = ateSessionManager.completeSession();
    if (completed) setSession(completed);
  };

  // Prepare chart data
  const chartData = measurements
    .filter((m) => m.parameterName === 'Leakage Current') // Show primary parameter
    .sort((a, b) => a.testPointHours - b.testPointHours)
    .map((m, idx) => ({
      time: m.testPointHours,
      component: m.componentId,
      value: m.value,
      temperature: m.temperature,
      confidence: m.confidence,
    }));

  return (
    <div className="min-h-screen bg-neutral-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-neutral-900 mb-2">
            🔗 Live ATE Integration
          </h1>
          <p className="text-lg text-neutral-600">
            Real-time monitoring and data streaming from Automated Test Equipment
          </p>
        </div>

        {/* Connection Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Protocol Selection */}
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-neutral-600 uppercase mb-4">
              Connection Protocol
            </h3>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="protocol"
                  value="mqtt"
                  checked={useProtocol === 'mqtt'}
                  onChange={(e) => setUseProtocol('mqtt')}
                  disabled={connectionStatus?.mqtt?.connected || connectionStatus?.opcua?.connected}
                  className="w-4 h-4"
                />
                <div>
                  <p className="font-medium text-neutral-900">MQTT</p>
                  <p className="text-xs text-neutral-600">Lightweight IoT protocol</p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="protocol"
                  value="opc-ua"
                  checked={useProtocol === 'opc-ua'}
                  onChange={(e) => setUseProtocol('opc-ua')}
                  disabled={connectionStatus?.mqtt?.connected || connectionStatus?.opcua?.connected}
                  className="w-4 h-4"
                />
                <div>
                  <p className="font-medium text-neutral-900">OPC-UA</p>
                  <p className="text-xs text-neutral-600">Industrial standard protocol</p>
                </div>
              </label>
            </div>

            <Button
              onClick={handleInitializeConnection}
              disabled={
                isConnecting ||
                connectionStatus?.mqtt?.connected ||
                connectionStatus?.opcua?.connected
              }
              className="w-full mt-4"
            >
              {isConnecting ? 'Connecting...' : 'Initialize Connection'}
            </Button>
          </Card>

          {/* Connection Status */}
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-neutral-600 uppercase mb-4">
              Status
            </h3>
            {connectionStatus ? (
              <div className="space-y-3">
                {connectionStatus.mqtt && (
                  <div>
                    <p className="text-xs text-neutral-600">MQTT</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          connectionStatus.mqtt.connected ? 'bg-green-500' : 'bg-red-500'
                        }`}
                      />
                      <p className="font-mono text-sm">
                        {connectionStatus.mqtt.connected ? 'Connected' : 'Disconnected'}
                      </p>
                    </div>
                  </div>
                )}

                {connectionStatus.opcua && (
                  <div>
                    <p className="text-xs text-neutral-600">OPC-UA</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          connectionStatus.opcua.connected ? 'bg-green-500' : 'bg-red-500'
                        }`}
                      />
                      <p className="font-mono text-sm">
                        {connectionStatus.opcua.connected ? 'Connected' : 'Disconnected'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-neutral-500 text-sm">Not connected</p>
            )}
          </Card>

          {/* Session Controls */}
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-neutral-600 uppercase mb-4">
              Test Session
            </h3>
            {session ? (
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-neutral-600">Status</p>
                  <Badge
                    className={`mt-1 ${
                      session.status === 'running'
                        ? 'bg-blue-100 text-blue-900'
                        : session.status === 'completed'
                          ? 'bg-green-100 text-green-900'
                          : 'bg-yellow-100 text-yellow-900'
                    }`}
                  >
                    {session.status.toUpperCase()}
                  </Badge>
                </div>
                <p className="text-neutral-600">
                  <strong>{measurements.length}</strong> measurements received
                </p>
                <Button
                  onClick={handleCompleteSession}
                  variant="destructive"
                  className="w-full"
                  disabled={session.status !== 'running'}
                >
                  Complete Session
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleStartSession}
                disabled={!connectionStatus?.mqtt?.connected && !connectionStatus?.opcua?.connected}
                className="w-full"
              >
                Start Test Session
              </Button>
            )}
          </Card>
        </div>

        {/* Equipment Status Panel */}
        {latestStatus && (
          <Card className="p-6 mb-8 border-blue-200 bg-blue-50">
            <h3 className="text-sm font-semibold text-blue-900 uppercase mb-4">
              📊 Equipment Status
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-blue-700">Equipment</p>
                <p className="font-mono text-lg text-blue-900">{latestStatus.equipmentId}</p>
              </div>
              <div>
                <p className="text-xs text-blue-700">State</p>
                <p className="font-mono text-lg text-blue-900 capitalize">{latestStatus.state}</p>
              </div>
              <div>
                <p className="text-xs text-blue-700">Test Point</p>
                <p className="font-mono text-lg text-blue-900">{latestStatus.currentTestPoint}h</p>
              </div>
              <div>
                <p className="text-xs text-blue-700">Progress</p>
                <p className="font-mono text-lg text-blue-900">{latestStatus.testProgress.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-xs text-blue-700">Component</p>
                <p className="font-mono text-lg text-blue-900">{latestStatus.currentComponent}</p>
              </div>
              <div>
                <p className="text-xs text-blue-700">Temperature</p>
                <p className="font-mono text-lg text-blue-900">
                  {latestStatus.temperatureActual.toFixed(1)}°C
                </p>
              </div>
              <div>
                <p className="text-xs text-blue-700">Time Remaining</p>
                <p className="font-mono text-lg text-blue-900">
                  {Math.floor(latestStatus.estimatedTimeRemaining / 3600)}h
                </p>
              </div>
              {latestStatus.errorMessage && (
                <div className="col-span-full p-2 bg-red-100 rounded border border-red-300">
                  <p className="text-xs text-red-700">
                    <strong>Error:</strong> {latestStatus.errorMessage}
                  </p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Measurements Chart */}
        {chartData.length > 0 && (
          <Card className="p-6 mb-8">
            <h3 className="text-sm font-semibold text-neutral-600 uppercase mb-4">
              📈 Real-Time Measurements (Leakage Current)
            </h3>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="time"
                  label={{ value: 'Test Point (hours)', position: 'insideBottomRight', offset: -5 }}
                />
                <YAxis label={{ value: 'µA', angle: -90, position: 'insideLeft' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb' }}
                  labelFormatter={(time) => `${time}h`}
                  formatter={(value, name, props) => {
                    if (name === 'value') {
                      return [`${Number(value).toFixed(2)} µA`, props.payload.component];
                    }
                    return [value, name];
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Data Feed */}
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-neutral-600 uppercase mb-4">
            📡 Data Feed ({measurements.length} measurements)
          </h3>
          <div className="max-h-96 overflow-y-auto">
            {measurements.length === 0 ? (
              <p className="text-neutral-500 text-sm py-8 text-center">
                Awaiting live data from ATE...
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200">
                    <th className="text-left py-2 px-3 text-neutral-700 font-semibold">Component</th>
                    <th className="text-left py-2 px-3 text-neutral-700 font-semibold">Parameter</th>
                    <th className="text-left py-2 px-3 text-neutral-700 font-semibold">Value</th>
                    <th className="text-left py-2 px-3 text-neutral-700 font-semibold">Time</th>
                    <th className="text-left py-2 px-3 text-neutral-700 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {measurements.slice(-20).map((m, idx) => (
                    <tr key={idx} className="border-b border-neutral-100 hover:bg-neutral-50">
                      <td className="py-2 px-3 font-mono text-neutral-900">{m.componentId}</td>
                      <td className="py-2 px-3 text-neutral-700">{m.parameterName}</td>
                      <td className="py-2 px-3 font-mono text-neutral-900">
                        {m.value.toFixed(3)} {m.unit}
                      </td>
                      <td className="py-2 px-3 text-neutral-600 text-xs">
                        {m.testPointHours}h @ {m.temperature.toFixed(0)}°C
                      </td>
                      <td className="py-2 px-3">
                        <Badge
                          className={`text-xs ${
                            m.status === 'valid'
                              ? 'bg-green-100 text-green-900'
                              : m.status === 'questionable'
                                ? 'bg-yellow-100 text-yellow-900'
                                : 'bg-red-100 text-red-900'
                          }`}
                        >
                          {m.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
