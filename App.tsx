import React, { useState, useCallback } from 'react';
import { ThermalCanvas } from './components/ThermalCanvas';
import { analyzeThermalImage } from './services/geminiService';
import { HeatStats, GeminiAnalysisResult } from './types';
import { Activity, Zap, Thermometer, Scan, Loader2, Info, AlertTriangle } from 'lucide-react';

const App: React.FC = () => {
  const [stats, setStats] = useState<HeatStats | null>(null);
  const [analysis, setAnalysis] = useState<GeminiAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [screenshotTrigger, setScreenshotTrigger] = useState(0);

  const handleStatsUpdate = useCallback((newStats: HeatStats) => {
    // Throttle state updates if needed, but React 18 handles this well
    setStats(newStats);
  }, []);

  const triggerAnalysis = () => {
    setScreenshotTrigger(prev => prev + 1);
    setIsAnalyzing(true);
    setAnalysis(null);
  };

  const handleScreenshotReady = async (dataUrl: string) => {
    try {
      const result = await analyzeThermalImage(dataUrl);
      setAnalysis(result);
    } catch (err) {
      console.error(err);
      // Fallback UI in case service throws (though service now mostly returns fallback data)
      setAnalysis({
          title: "SYSTEM FAILURE",
          energyLevel: "0%",
          description: "Critical error in analysis module.",
          elements: ["Sensor Offline"]
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="relative w-full h-screen bg-black text-white overflow-hidden flex flex-col md:flex-row">
      
      {/* Main Viewport */}
      <div className="flex-1 relative order-2 md:order-1 h-[60vh] md:h-full">
        <ThermalCanvas 
          onStatsUpdate={handleStatsUpdate}
          screenshotTrigger={screenshotTrigger}
          onScreenshotReady={handleScreenshotReady}
        />

        {/* HUD Overlays */}
        <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none">
           <div className="bg-black/40 backdrop-blur-md border border-blue-500/30 p-2 rounded text-xs font-mono text-blue-200">
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

        {/* Interactive Stats Overlay (Bottom Left) */}
        <div className="absolute bottom-4 left-4 pointer-events-none">
           <div className="bg-black/60 backdrop-blur-md border border-white/10 p-4 rounded-lg min-w-[200px]">
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

      {/* Control & Analysis Panel (Sidebar) */}
      <div className="relative order-1 md:order-2 w-full md:w-[350px] bg-[#0a0a0a] border-l border-gray-800 flex flex-col z-10 shadow-2xl">
        <div className="p-6 border-b border-gray-800">
           <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400 tracking-tighter">
             THERMAL<span className="font-light text-white">FLOW</span>
           </h1>
           <p className="text-xs text-gray-500 mt-1">Bio-Etheric Visualization Engine</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
           {/* Gemini Analysis Section */}
           <div className="space-y-4">
              <div className="flex items-center justify-between">
                 <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                   <Zap size={16} className="text-yellow-500" />
                   AI SCANNER
                 </h2>
                 {isAnalyzing && <Loader2 size={16} className="animate-spin text-blue-500" />}
              </div>

              <button 
                onClick={triggerAnalysis}
                disabled={isAnalyzing}
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 text-white rounded font-mono text-sm font-bold tracking-wider transition-all flex items-center justify-center gap-2 group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                <Scan size={18} />
                {isAnalyzing ? 'PROCESSING SCAN...' : 'ANALYZE SIGNATURE'}
              </button>

              {analysis ? (
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                   <div>
                     <span className="text-xs font-mono text-blue-400 uppercase">Subject State</span>
                     <h3 className="text-lg font-bold text-white leading-tight mt-1">{analysis.title}</h3>
                   </div>
                   
                   <div className="grid grid-cols-2 gap-2">
                      <div className="bg-black/50 p-2 rounded border border-gray-800">
                        <span className="text-[10px] text-gray-500 uppercase block">Energy</span>
                        <span className="text-sm font-mono text-yellow-400">{analysis.energyLevel}</span>
                      </div>
                      <div className="bg-black/50 p-2 rounded border border-gray-800">
                        <span className="text-[10px] text-gray-500 uppercase block">Stability</span>
                        <span className="text-sm font-mono text-green-400">OPTIMAL</span>
                      </div>
                   </div>

                   <div>
                      <span className="text-xs font-mono text-gray-500 uppercase">Analysis</span>
                      <p className="text-sm text-gray-300 mt-1 leading-relaxed">
                        {analysis.description}
                      </p>
                   </div>

                   <div className="space-y-1">
                      {analysis.elements?.map((el, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-gray-400">
                           <span className="w-1 h-1 bg-blue-500 rounded-full" />
                           {el}
                        </div>
                      ))}
                      {(!analysis.elements || analysis.elements.length === 0) && (
                          <div className="text-xs text-gray-600 italic">No specific elements detected.</div>
                      )}
                   </div>
                </div>
              ) : (
                <div className="border border-dashed border-gray-800 rounded-lg p-8 flex flex-col items-center text-center">
                   <Info size={24} className="text-gray-700 mb-2" />
                   <p className="text-xs text-gray-600">
                     Perform a scan to generate a physiological energy report powered by Gemini AI.
                   </p>
                </div>
              )}
           </div>
        </div>

        <div className="p-4 border-t border-gray-800 bg-black/20 text-[10px] text-gray-600 font-mono text-center">
          SYSTEM V2.5.0 // REACT 18 // MEDIAPIPE // GEMINI
        </div>
      </div>
    </div>
  );
};

export default App;