import React, { useState, useCallback } from 'react';
import { ThermalCanvas } from './components/ThermalCanvas';
import { HeatStats } from './types';
import { Activity, Thermometer } from 'lucide-react';

const App: React.FC = () => {
  const [stats, setStats] = useState<HeatStats | null>(null);

  const handleStatsUpdate = useCallback((newStats: HeatStats) => {
    setStats(newStats);
  }, []);

  return (
    <div className="relative w-full h-screen bg-black text-white overflow-hidden">
      
      {/* Full Screen Thermal Canvas */}
      <div className="absolute inset-0 z-0">
        <ThermalCanvas onStatsUpdate={handleStatsUpdate} />
      </div>

      {/* HUD Overlays (Top Left) */}
      <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none z-10">
         <div className="bg-black/40 backdrop-blur-md border border-blue-500/30 p-2 rounded text-xs font-mono text-blue-200 shadow-lg">
            <div className="flex items-center gap-2 mb-1">
              <Activity size={14} /> 
              <span>SENSOR STATUS: ONLINE</span>
            </div>
            <div className="flex items-center gap-2">
               <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
               <span>60 FPS LOCKED</span>
            </div>
         </div>
      </div>

      {/* Thermal Legend (Top Right) - Minimalist & Transparent */}
      <div className="absolute top-6 right-6 z-10 flex flex-col items-center gap-1 opacity-40 hover:opacity-100 transition-opacity duration-300 pointer-events-auto select-none">
          <span className="text-[10px] font-mono text-white/90 drop-shadow-md tracking-wider">HOT</span>
          {/* Exact gradient stops matching utils/colorMapService.ts */}
          <div 
            className="w-3 h-32 rounded-full border border-white/20 shadow-xl backdrop-blur-sm"
            style={{
                background: `linear-gradient(to top, 
                  rgb(0,0,20) 0%, 
                  rgb(0,0,128) 15%, 
                  rgb(0,128,255) 30%, 
                  rgb(0,255,200) 45%, 
                  rgb(50,255,50) 55%, 
                  rgb(255,255,0) 65%, 
                  rgb(255,128,0) 75%, 
                  rgb(255,0,0) 85%, 
                  rgb(255,0,255) 95%, 
                  rgb(255,255,255) 100%
                )`
            }}
          />
          <span className="text-[10px] font-mono text-white/90 drop-shadow-md tracking-wider">COLD</span>
      </div>

      {/* Interactive Stats Overlay (Bottom Left) */}
      <div className="absolute bottom-4 left-4 pointer-events-none z-10">
         <div className="bg-black/60 backdrop-blur-md border border-white/10 p-4 rounded-lg min-w-[200px] shadow-2xl">
            <h3 className="text-xs font-bold text-gray-400 mb-2 font-mono uppercase tracking-widest">Heat Signature</h3>
            
            <div className="flex items-center justify-between mb-2">
               <span className="text-sm text-blue-300 flex items-center gap-2"><Thermometer size={14} /> Intensity</span>
               <span className="text-xl font-bold font-mono">
                  {stats ? Math.round(stats.totalHeat / 100) : 0}<span className="text-xs text-gray-500">kcal</span>
               </span>
            </div>
            
            <div className="w-full bg-gray-800 h-1 rounded overflow-hidden">
               <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-red-500 transition-all duration-300" 
                  style={{ width: `${Math.min(100, (stats?.totalHeat || 0) / 50)}%` }}
               />
            </div>

            <div className="mt-2 text-xs text-gray-500 font-mono">
               CENTROID: [{stats?.centroid.x.toFixed(2)}, {stats?.centroid.y.toFixed(2)}]
            </div>
         </div>
      </div>
    </div>
  );
};

export default App;