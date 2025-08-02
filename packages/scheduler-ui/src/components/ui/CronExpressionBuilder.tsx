import React, { useState, useEffect } from 'react';
// Assuming you have these dependencies installed:
// npm install @headlessui/react @heroicons/react
import { Dialog } from '@headlessui/react';
import { XMarkIcon, ClockIcon } from '@heroicons/react/24/outline';

// Props interface for the component
interface CronExpressionBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  initialValue?: string;
  onSave: (cronExpression: string) => void;
  onPresetSelect?: (cronExpression: string) => void;
}

// Defines the types of schedules available
type CronType = 'minute' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';

// State interface for managing cron configuration
interface CronConfig {
  type: CronType;
  minute: number;
  hour: number;
  dayOfMonth: number;
  month: number; // Note: month is not used in the UI but kept for structure
  dayOfWeek: number;
  expression: string;
}

/**
 * A React component that provides a user-friendly interface for building Cron expressions.
 */
const CronExpressionBuilder: React.FC<CronExpressionBuilderProps> = ({
  isOpen,
  onClose,
  initialValue = '0 9 * * 1-5', // Default to weekdays at 9 AM
  onSave,
  onPresetSelect
}) => {
  // State for the main configuration object
  const [config, setConfig] = useState<CronConfig>({
    type: 'daily',
    minute: 0,
    hour: 9,
    dayOfMonth: 1,
    month: 1,
    dayOfWeek: 1,
    expression: initialValue
  });

  // State specifically for the custom expression input
  const [customExpression, setCustomExpression] = useState(initialValue);

  /**
   * Effect to rebuild the cron expression whenever the configuration changes,
   * except when in 'custom' mode.
   */
  useEffect(() => {
    if (config.type !== 'custom') {
      const expression = buildCronExpression(config);
      setConfig(prev => ({ ...prev, expression }));
    }
  }, [config.type, config.minute, config.hour, config.dayOfMonth, config.month, config.dayOfWeek]);

  /**
   * Builds a cron string from the current state configuration.
   * @param config The current cron configuration.
   * @returns A standard 5-part cron expression string.
   */
  const buildCronExpression = (config: CronConfig): string => {
    const { type, minute, hour, dayOfMonth, dayOfWeek } = config;

    switch (type) {
      case 'minute':
        return '* * * * *';
      case 'hourly':
        return `${minute} * * * *`;
      case 'daily':
        return `${minute} ${hour} * * *`;
      case 'weekly':
        return `${minute} ${hour} * * ${dayOfWeek}`;
      case 'monthly':
        return `${minute} ${hour} ${dayOfMonth} * *`;
      default:
        return config.expression; // Should not happen for non-custom types
    }
  };

  /**
   * Parses an incoming cron expression string to populate the UI state.
   * This allows the builder to initialize with an existing value.
   * @param expression The cron expression string to parse.
   * @returns A CronConfig object.
   */
  const parseCronExpression = (expression: string): CronConfig => {
    const parts = expression.split(' ');
    const defaultConfig = { minute: 0, hour: 9, dayOfMonth: 1, month: 1, dayOfWeek: 1, expression };

    if (parts.length !== 5) {
      return { ...defaultConfig, type: 'custom' };
    }

    const [min, hr, dom, , dow] = parts;

    // Simple pattern matching to determine the schedule type
    if (min === '*' && hr === '*' && dom === '*' && dow === '*') return { ...defaultConfig, type: 'minute', expression };
    if (hr === '*' && dom === '*' && dow === '*') return { ...defaultConfig, type: 'hourly', minute: parseInt(min) || 0, expression };
    if (dom === '*' && dow !== '*') return { ...defaultConfig, type: 'weekly', minute: parseInt(min) || 0, hour: parseInt(hr) || 9, dayOfWeek: parseInt(dow) || 1, expression };
    if (dom !== '*' && dow === '*') return { ...defaultConfig, type: 'monthly', minute: parseInt(min) || 0, hour: parseInt(hr) || 9, dayOfMonth: parseInt(dom) || 1, expression };
    if (dom === '*' && dow === '*') return { ...defaultConfig, type: 'daily', minute: parseInt(min) || 0, hour: parseInt(hr) || 9, expression };
    
    // If no pattern matches, treat it as custom
    return { ...defaultConfig, type: 'custom', expression };
  };

  /**
   * Effect to parse the initial cron value when the component mounts or the value changes.
   */
  useEffect(() => {
    if (initialValue) {
      const parsed = parseCronExpression(initialValue);
      setConfig(parsed);
      setCustomExpression(initialValue);
    }
  }, [initialValue]);

  /**
   * Handles the save action, passing the final expression to the parent component.
   */
  const handleSave = () => {
    const finalExpression = config.type === 'custom' ? customExpression : config.expression;
    onSave(finalExpression);
    onClose(); // Close modal on save
  };

  /**
   * Generates a human-readable description of the current cron schedule.
   * @returns A descriptive string.
   */
  const getDescription = (): string => {
    const { type, minute, hour, dayOfMonth, dayOfWeek } = config;
    const expression = config.type === 'custom' ? customExpression : config.expression;

    if (config.type === 'custom') {
      return `Custom schedule: ${expression}`;
    }

    const formatTime = (h: number, m: number) => {
      const period = h >= 12 ? 'PM' : 'AM';
      const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const displayMinute = m.toString().padStart(2, '0');
      return `${displayHour}:${displayMinute} ${period}`;
    };

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    switch (type) {
      case 'minute': return 'Every minute';
      case 'hourly': return `Every hour at ${minute} minutes past the hour`;
      case 'daily': return `Every day at ${formatTime(hour, minute)}`;
      case 'weekly': return `Every ${days[dayOfWeek]} at ${formatTime(hour, minute)}`;
      case 'monthly': return `Every month on day ${dayOfMonth} at ${formatTime(hour, minute)}`;
      default: return expression;
    }
  };

  // A list of common cron presets for quick selection
  const presets = [
    { label: 'Every minute', value: '* * * * *' },
    { label: 'Every 5 minutes', value: '*/5 * * * *' },
    { label: 'Every 15 minutes', value: '*/15 * * * *' },
    { label: 'Every 30 minutes', value: '*/30 * * * *' },
    { label: 'Every hour', value: '0 * * * *' },
    { label: 'Every 2 hours', value: '0 */2 * * *' },
    { label: 'Every 6 hours', value: '0 */6 * * *' },
    { label: 'Every 12 hours', value: '0 */12 * * *' },
    { label: 'Daily at 9 AM', value: '0 9 * * *' },
    { label: 'Daily at 6 PM', value: '0 18 * * *' },
    { label: 'Weekdays at 9 AM', value: '0 9 * * 1-5' },
    { label: 'Weekly (Monday 9 AM)', value: '0 9 * * 1' },
    { label: 'Monthly (1st at 9 AM)', value: '0 9 1 * *' }
  ];

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      {/* Modal Backdrop */}
      <div className="fixed inset-0 bg-black/25" aria-hidden="true" />
      
      {/* Modal Content */}
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-2xl w-full bg-white rounded-lg shadow-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <Dialog.Title className="text-lg font-semibold text-gray-900 flex items-center">
                <ClockIcon className="w-5 h-5 mr-2 text-blue-600" />
                Cron Expression Builder
              </Dialog.Title>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Schedule Type Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Schedule Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['minute', 'hourly', 'daily', 'weekly', 'monthly', 'custom'] as CronType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setConfig(prev => ({ ...prev, type }));
                      }}
                      className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                        config.type === type
                          ? 'bg-blue-50 border-blue-500 text-blue-700'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Type-specific controls */}
              {config.type !== 'minute' && config.type !== 'custom' && (
                <div className="grid grid-cols-2 gap-4 border-t pt-4">
                  {/* Minute Selector */}
                  {(config.type === 'hourly' || config.type === 'daily' || config.type === 'weekly' || config.type === 'monthly') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Minute</label>
                      <select
                        value={config.minute}
                        onChange={(e) => setConfig(prev => ({ ...prev, minute: parseInt(e.target.value) }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {Array.from({ length: 60 }, (_, i) => <option key={i} value={i}>{i.toString().padStart(2, '0')}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Hour Selector */}
                  {(config.type === 'daily' || config.type === 'weekly' || config.type === 'monthly') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Hour</label>
                      <select
                        value={config.hour}
                        onChange={(e) => setConfig(prev => ({ ...prev, hour: parseInt(e.target.value) }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {Array.from({ length: 24 }, (_, i) => {
                          const period = i >= 12 ? 'PM' : 'AM';
                          const displayHour = i === 0 ? 12 : i > 12 ? i - 12 : i;
                          return <option key={i} value={i}>{`${displayHour}:00 ${period} (${i.toString().padStart(2, '0')}:00)`}</option>;
                        })}
                      </select>
                    </div>
                  )}

                  {/* Day of Week Selector */}
                  {config.type === 'weekly' && (
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Day of Week</label>
                      <select
                        value={config.dayOfWeek}
                        onChange={(e) => setConfig(prev => ({ ...prev, dayOfWeek: parseInt(e.target.value) }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value={0}>Sunday</option>
                        <option value={1}>Monday</option>
                        <option value={2}>Tuesday</option>
                        <option value={3}>Wednesday</option>
                        <option value={4}>Thursday</option>
                        <option value={5}>Friday</option>
                        <option value={6}>Saturday</option>
                      </select>
                    </div>
                  )}

                  {/* Day of Month Selector */}
                  {config.type === 'monthly' && (
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Day of Month</label>
                      <select
                        value={config.dayOfMonth}
                        onChange={(e) => setConfig(prev => ({ ...prev, dayOfMonth: parseInt(e.target.value) }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Custom Expression Input */}
              {config.type === 'custom' && (
                <div className="border-t pt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Custom Cron Expression</label>
                  <input
                    type="text"
                    value={customExpression}
                    onChange={(e) => setCustomExpression(e.target.value)}
                    className="w-full px-3 py-2 font-mono border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="* * * * *"
                  />
                  <p className="mt-1 text-xs text-gray-500">Format: minute hour day-of-month month day-of-week</p>
                </div>
              )}

              {/* Presets Section */}
              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Quick Presets</label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1">
                  {presets.map((preset, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const parsed = parseCronExpression(preset.value);
                        setConfig(parsed);
                        setCustomExpression(preset.value);
                        // Only update the expression, don't close the modal
                        if (onPresetSelect) {
                          onPresetSelect(preset.value);
                        } else {
                          onSave(preset.value);
                        }
                      }}
                      className="text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-md transition-colors"
                    >
                      <div className="font-medium text-gray-800">{preset.label}</div>
                      <div className="text-xs text-gray-500 font-mono">{preset.value}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Current Expression and Description */}
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-md">
                <h4 className="text-sm font-medium text-blue-900 mb-2">Current Schedule</h4>
                <div className="space-y-1">
                  <div className="text-sm">
                    <span className="font-medium text-blue-900">Expression:</span>
                    <code className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded font-mono">
                      {config.type === 'custom' ? customExpression : config.expression}
                    </code>
                  </div>
                  <div className="text-sm text-blue-700">
                    <span className="font-medium">Description:</span> {getDescription()}
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end space-x-3 pt-6 border-t">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Use This Schedule
                </button>
              </div>
            </div>
          </Dialog.Panel>
        </div>
      </div>
    </Dialog>
  );
};

export default CronExpressionBuilder;
