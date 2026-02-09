import React, { useState } from 'react';
import { RefreshCw, Trash2, Database, HardDrive, FileText, TestTube } from 'lucide-react';
import { devTools } from '../utils/devTools';

/**
 * DevTools Panel Component
 *
 * Provides UI buttons for all devTools functions
 * Admin-only panel for managing team logos and storage
 */

const DevToolsPanel: React.FC = () => {
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const handleAction = async (actionName: string, action: () => Promise<any>) => {
    setLoading(actionName);
    setResult(null);
    try {
      const res = await action();
      setResult(JSON.stringify(res, null, 2));
    } catch (error) {
      setResult(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="w-full max-w-5xl mt-8 space-y-6">
      <div className="bg-brand-lighter border border-brand-light rounded-lg p-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
          <Database className="w-5 h-5 mr-2" />
          Logo Resolution
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={() => handleAction('resolveAllLogos', () => devTools.resolveAllLogos())}
            disabled={!!loading}
            className="flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading === 'resolveAllLogos' ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Resolve All Logos
          </button>

          <button
            onClick={() => handleAction('resolveAllLogosForce', () => devTools.resolveAllLogos(true))}
            disabled={!!loading}
            className="flex items-center justify-center px-4 py-3 bg-blue-700 text-white rounded-md hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading === 'resolveAllLogosForce' ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Force Resolve All
          </button>

          <button
            onClick={() => handleAction('clearCache', () => Promise.resolve(devTools.clearCache()))}
            disabled={!!loading}
            className="flex items-center justify-center px-4 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading === 'clearCache' ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4 mr-2" />
            )}
            Clear Cache
          </button>

          <button
            onClick={() => handleAction('populateApiNames', () => devTools.populateApiNames())}
            disabled={!!loading}
            className="flex items-center justify-center px-4 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading === 'populateApiNames' ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FileText className="w-4 h-4 mr-2" />
            )}
            Populate API Names
          </button>
        </div>
      </div>

      <div className="bg-brand-lighter border border-brand-light rounded-lg p-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
          <HardDrive className="w-5 h-5 mr-2" />
          Storage Migration
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={() => handleAction('migrateLogosToStorage', () => devTools.migrateLogosToStorage())}
            disabled={!!loading}
            className="flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading === 'migrateLogosToStorage' ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <HardDrive className="w-4 h-4 mr-2" />
            )}
            Migrate to Storage
          </button>

          <button
            onClick={() => handleAction('migrateLogosToStorageForce', () => devTools.migrateLogosToStorage(true))}
            disabled={!!loading}
            className="flex items-center justify-center px-4 py-3 bg-green-700 text-white rounded-md hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading === 'migrateLogosToStorageForce' ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <HardDrive className="w-4 h-4 mr-2" />
            )}
            Force Migrate All
          </button>

          <button
            onClick={() => handleAction('checkStorageMigrationStatus', () => devTools.checkStorageMigrationStatus())}
            disabled={!!loading}
            className="flex items-center justify-center px-4 py-3 bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading === 'checkStorageMigrationStatus' ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Database className="w-4 h-4 mr-2" />
            )}
            Check Migration Status
          </button>

          <button
            onClick={() => handleAction('getStorageStats', () => devTools.getStorageStats())}
            disabled={!!loading}
            className="flex items-center justify-center px-4 py-3 bg-teal-700 text-white rounded-md hover:bg-teal-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading === 'getStorageStats' ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Database className="w-4 h-4 mr-2" />
            )}
            Storage Statistics
          </button>

          <button
            onClick={() => handleAction('listTeamsNeedingMigration', () => devTools.listTeamsNeedingMigration())}
            disabled={!!loading}
            className="flex items-center justify-center px-4 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading === 'listTeamsNeedingMigration' ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FileText className="w-4 h-4 mr-2" />
            )}
            List Teams Needing Migration
          </button>

          <button
            onClick={() => {
              const teamName = prompt('Enter team name to test migration:');
              if (teamName) {
                handleAction('testTeamStorageMigration', () => devTools.testTeamStorageMigration(teamName));
              }
            }}
            disabled={!!loading}
            className="flex items-center justify-center px-4 py-3 bg-indigo-700 text-white rounded-md hover:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading === 'testTeamStorageMigration' ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <TestTube className="w-4 h-4 mr-2" />
            )}
            Test Team Migration
          </button>
        </div>
      </div>

      <div className="bg-brand-lighter border border-brand-light rounded-lg p-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
          <TestTube className="w-5 h-5 mr-2" />
          Testing
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={() => {
              const teamName = prompt('Enter team name to test logo resolution:');
              if (teamName) {
                handleAction('testTeamLogo', () => devTools.testTeamLogo(teamName));
              }
            }}
            disabled={!!loading}
            className="flex items-center justify-center px-4 py-3 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading === 'testTeamLogo' ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <TestTube className="w-4 h-4 mr-2" />
            )}
            Test Team Logo
          </button>
        </div>
      </div>

      {result && (
        <div className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto">
          <h4 className="text-sm font-semibold mb-2 text-gray-300">Result:</h4>
          <pre className="text-xs whitespace-pre-wrap font-mono">{result}</pre>
        </div>
      )}
    </div>
  );
};

export default DevToolsPanel;
