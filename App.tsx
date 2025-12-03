import React, { useState } from 'react';
import GameCanvas from './components/GameCanvas';
import { GameState, LevelInfo } from './types';
import { generateLevelInfo } from './services/geminiService';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [level, setLevel] = useState<number>(1);
  const [levelInfo, setLevelInfo] = useState<LevelInfo | null>(null);
  const [loadingText, setLoadingText] = useState<string>("Initializing...");

  const startGame = async () => {
    setGameState(GameState.LOADING_LEVEL);
    setLoadingText("Generating World with Gemini AI...");
    
    // Fetch Level Data
    const info = await generateLevelInfo(level);
    setLevelInfo(info);
    
    setGameState(GameState.PLAYING);
  };

  const handleLevelComplete = () => {
    setGameState(GameState.VICTORY);
  };

  const handleNextLevel = () => {
    setLevel(prev => prev + 1);
    startGame();
  };

  const handleGameOver = () => {
    setGameState(GameState.GAME_OVER);
  };

  const handleRestart = () => {
    setLevel(1);
    startGame();
  };

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden font-sans select-none scanlines">
      {/* Game Layer */}
      <GameCanvas 
        gameState={gameState} 
        setGameState={setGameState} 
        levelInfo={levelInfo}
        onLevelComplete={handleLevelComplete}
        onGameOver={handleGameOver}
      />

      {/* Menu Overlay */}
      {gameState === GameState.MENU && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-50 text-white">
          <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-500 to-pink-500 bg-clip-text text-transparent mb-8 drop-shadow-lg">
            Crystal Hunters: Duo Chronicles
          </h1>
          <p className="text-gray-300 mb-8 max-w-2xl text-center leading-relaxed text-lg">
            A co-op rogue-lite shooter.
            <br /><br />
            <div className="grid grid-cols-2 gap-8 text-left pl-20">
              <div>
                <span className="text-blue-400 font-bold block mb-2">Player 1 (Boy)</span> 
                WASD to Move<br/>Space to Shoot
              </div>
              <div>
                <span className="text-pink-400 font-bold block mb-2">Player 2 (Girl)</span> 
                Arrow Keys to Move<br/>Enter to Shoot
              </div>
            </div>
            <br />
            <span className="text-green-400">RADAR:</span> Check Top-Right to find Crystals (Purple) and Crates (Yellow).
            <br />
            <span className="text-orange-400">CRATES:</span> Shoot or touch orange crates to find new weapons!
          </p>
          <button 
            onClick={startGame}
            className="px-8 py-4 bg-white text-black font-bold text-xl rounded hover:bg-gray-200 transition-all transform hover:scale-105"
          >
            Start Adventure
          </button>
        </div>
      )}

      {/* Loading Screen */}
      {gameState === GameState.LOADING_LEVEL && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-50 text-white">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <h2 className="text-2xl font-mono animate-pulse">{loadingText}</h2>
        </div>
      )}

      {/* Victory / Next Level Screen */}
      {gameState === GameState.VICTORY && levelInfo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-green-900/90 z-50 text-white backdrop-blur-sm">
          <h1 className="text-5xl font-bold mb-4 text-green-300">Sector Cleared!</h1>
          <p className="text-xl mb-6">Boss <span className="text-red-400 font-bold">{levelInfo.bossName}</span> defeated.</p>
          <button 
            onClick={handleNextLevel}
            className="px-8 py-4 bg-green-500 text-black font-bold text-xl rounded hover:bg-green-400 shadow-[0_0_20px_rgba(34,197,94,0.5)] transition-all"
          >
            Warp to Level {level + 1}
          </button>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState === GameState.GAME_OVER && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-900/90 z-50 text-white backdrop-blur-sm">
          <h1 className="text-6xl font-bold mb-4 text-red-500 drop-shadow-md">DEFEAT</h1>
          <p className="text-xl mb-8">The journey ends here...</p>
          <button 
            onClick={handleRestart}
            className="px-8 py-4 bg-white text-black font-bold text-xl rounded hover:bg-gray-200"
          >
            Restart Journey
          </button>
        </div>
      )}
      
      {/* Intro / Level Title Card overlay (Fades out) */}
      {gameState === GameState.PLAYING && levelInfo && (
        <div className="absolute top-1/4 w-full text-center pointer-events-none animate-[fadeOut_4s_forwards] z-40">
            <h2 className="text-5xl font-black text-white drop-shadow-[0_5px_5px_rgba(0,0,0,1)] tracking-widest uppercase">
                {levelInfo.biomeName}
            </h2>
            <p className="text-xl text-yellow-300 mt-2 font-serif italic shadow-black drop-shadow-md max-w-2xl mx-auto bg-black/50 p-2 rounded">
                "{levelInfo.description}"
            </p>
        </div>
      )}

      <style>{`
        @keyframes fadeOut {
            0% { opacity: 1; transform: scale(1); }
            80% { opacity: 1; transform: scale(1.05); }
            100% { opacity: 0; transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
};

export default App;