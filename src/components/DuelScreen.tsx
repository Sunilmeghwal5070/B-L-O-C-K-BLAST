import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '../utils/firebase';
import { doc, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore';
import { useGameEngine, getLevelProgress } from '../hooks/useGameEngine';
import { PreviewShape } from './PreviewShape';
import { sound } from '../utils/soundEngine';
import { cn } from '../utils/cn';
import { GRID_SIZE } from '../constants';
import { 
  Mic, MicOff, Volume2, VolumeX, MessageSquare, 
  X, Trophy, Sparkles, Smile, Radio, Swords, Skull, Flame
} from 'lucide-react';

type Props = {
  key?: string;
  matchId: string;
  onGoHome: () => void;
};

const CHAT_TEMPLATES = [
  "Let's go! 🔥",
  "GG! Well played 🤝",
  "Check out my combo! ✨",
  "Nooo, my grid is full! 😱",
  "Double block blast! 💥",
  "Lucky shapes today! 🍀",
  "Keep up the speed! ⚡",
  "Play again? 🎮"
];

export function DuelScreen({ matchId, onGoHome }: Props) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [matchData, setMatchData] = useState<any>(null);

  // Microphone states
  const [isMicOn, setIsMicOn] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  
  // Local audio processing for visual mic waves
  const [myVolume, setMyVolume] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Chat/Alert messages inside match
  const [activeToast, setActiveToast] = useState<{ text: string, senderId: string } | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Game hooks for local gameplay
  const {
    grid, score, highScore, availableShapes, popups,
    clearingRows, clearingCols, comboCount, isGameOverStatus,
    placedCoords, currentLevel, checkAnyFits, placeShape, resetGame
  } = useGameEngine();

  const gridRef = useRef<HTMLDivElement>(null);
  const [gridCellSize, setGridCellSize] = useState(38);
  const [dragState, setDragState] = useState<{
    index: number;
    startX: number;
    startY: number;
  } | null>(null);
  const [hoverGridPos, setHoverGridPos] = useState<{ gridX: number, gridY: number } | null>(null);
  const pointerPosRef = useRef({ x: 0, y: 0 });

  // 1. Sync User info
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(user => {
      setCurrentUserId(user ? user.uid : null);
    });
    return () => unsub();
  }, []);

  // 2. Sync Match data and handle real-time audio/chats
  useEffect(() => {
    if (!currentUserId || !matchId) return;

    const unsub = onSnapshot(doc(db, 'matches', matchId), (snap) => {
      if (!snap.exists()) {
        alert("This duel has ended or was closed.");
        onGoHome();
        return;
      }
      const data = snap.data();
      setMatchData(data);

      // Handle chat toast trigger
      if (data.chatTime && (!activeToast || activeToast.text !== data.chatText)) {
        setActiveToast({ text: data.chatText || '', senderId: data.chatSenderId || '' });
        sound.playClear?.(); // Trigger a satisfying pop sound
        const timeout = setTimeout(() => {
          setActiveToast(null);
        }, 4000);
        return () => clearTimeout(timeout);
      }
    });

    return () => unsub();
  }, [currentUserId, matchId]);

  // 3. Send current score/grid updates to Firebase
  useEffect(() => {
    if (!currentUserId || !matchData || !matchId) return;

    const isChallenger = currentUserId === matchData.challengerId;
    const currentStatus = isGameOverStatus ? 'completed_one' : 'playing';

    const updates: any = {};
    if (isChallenger) {
      if (matchData.challengerScore !== score) updates.challengerScore = score;
      if (matchData.challengerFinished !== isGameOverStatus) updates.challengerFinished = isGameOverStatus;
    } else {
      if (matchData.challengeeScore !== score) updates.challengeeScore = score;
      if (matchData.challengeeFinished !== isGameOverStatus) updates.challengeeFinished = isGameOverStatus;
    }

    if (Object.keys(updates).length > 0) {
      updates.updatedAt = new Date().toISOString();
      updateDoc(doc(db, 'matches', matchId), updates).catch(e => console.warn(e));
    }
  }, [score, isGameOverStatus, currentUserId, matchId]);

  // 4. Update my mic status in Match Doc
  useEffect(() => {
    if (!currentUserId || !matchData || !matchId) return;
    const isChallenger = currentUserId === matchData.challengerId;
    
    const updates: any = {};
    if (isChallenger) {
      if (matchData.mic1 !== isMicOn) updates.mic1 = isMicOn;
      if (matchData.sound1 !== isSpeakerOn) updates.sound1 = isSpeakerOn;
    } else {
      if (matchData.mic2 !== isMicOn) updates.mic2 = isMicOn;
      if (matchData.sound2 !== isSpeakerOn) updates.sound2 = isSpeakerOn;
    }

    if (Object.keys(updates).length > 0) {
      updateDoc(doc(db, 'matches', matchId), updates).catch(e => console.warn(e));
    }
  }, [isMicOn, isSpeakerOn, currentUserId, matchId]);

  // 5. Microphone access and local volume processing
  useEffect(() => {
    if (isMicOn) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          micStreamRef.current = stream;
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          const ctx = new AudioContextClass();
          audioContextRef.current = ctx;

          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 512;
          analyserRef.current = analyser;
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const checkVolume = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            setMyVolume(Math.min(avg / 40, 1.2)); // map volume to safe animation scale
            animationFrameRef.current = requestAnimationFrame(checkVolume);
          };
          checkVolume();
        })
        .catch(err => {
          console.warn("Microphone access declined or failed:", err);
          setIsMicOn(false);
        });
    } else {
      // Cleanup microphone stream
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(t => t.stop());
        micStreamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      setMyVolume(0);
    }

    return () => {
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isMicOn]);

  // Adjust cellular layout size responsively
  useEffect(() => {
    const handleResize = () => {
      if (gridRef.current) {
        const width = gridRef.current.getBoundingClientRect().width;
        setGridCellSize(Math.floor((width - 40) / GRID_SIZE));
      }
    };
    handleResize();
    const observer = new ResizeObserver(handleResize);
    if (gridRef.current) observer.observe(gridRef.current);
    return () => observer.disconnect();
  }, []);

  const sendTemplateMessage = async (msg: string) => {
    if (!currentUserId || !matchId) return;
    sound.playClick?.();
    try {
      await updateDoc(doc(db, 'matches', matchId), {
        chatText: msg,
        chatSenderId: currentUserId,
        chatTime: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      setIsChatOpen(false);
    } catch (e) {
      console.warn("Send chat error:", e);
    }
  };

  const handleDragStart = (id: number, e: React.PointerEvent) => {
    if (isGameOverStatus) return;
    e.preventDefault();
    sound.playClick?.();
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    setDragState({
      index: id,
      startX: rect.left,
      startY: rect.top,
    });
    pointerPosRef.current = { x: e.clientX, y: e.clientY };
    el.setPointerCapture(e.pointerId);
  };

  const handleDragMove = (e: React.PointerEvent) => {
    if (!dragState) return;
    pointerPosRef.current = { x: e.clientX, y: e.clientY };

    const shape = availableShapes[dragState.index];
    if (!shape || !gridRef.current) return;

    const gridRect = gridRef.current.getBoundingClientRect();
    const cellWidth = gridRect.width / GRID_SIZE;
    const cellHeight = gridRect.height / GRID_SIZE;

    const gridX = Math.floor((e.clientX - gridRect.left) / cellWidth);
    const gridY = Math.floor((e.clientY - gridRect.top) / cellHeight);

    if (gridX >= 0 && gridX < GRID_SIZE && gridY >= 0 && gridY < GRID_SIZE) {
      setHoverGridPos({ gridX, gridY });
    } else {
      setHoverGridPos(null);
    }
  };

  const handleDragEnd = (id: number, e: React.PointerEvent) => {
    if (!dragState) return;
    const el = e.currentTarget as HTMLElement;
    el.releasePointerCapture(e.pointerId);

    const shape = availableShapes[id];
    if (shape && hoverGridPos) {
      const placed = placeShape(id, hoverGridPos.gridX, hoverGridPos.gridY, pointerPosRef.current.x, pointerPosRef.current.y);
      if (placed) {
        sound.playPlace?.();
      } else {
        sound.playError?.();
      }
    }

    setDragState(null);
    setHoverGridPos(null);
  };

  const endMatchAndQuit = async () => {
    if (!currentUserId || !matchId) return;
    sound.playClick?.();
    try {
      await deleteDoc(doc(db, 'matches', matchId));
    } catch (e) {}
    onGoHome();
  };

  if (!matchData || !currentUserId) {
    return (
      <div className="fixed inset-0 bg-zinc-950 flex flex-col items-center justify-center text-center">
        <Swords className="w-12 h-12 text-indigo-400 animate-bounce mb-4" />
        <p className="text-white/60 font-medium">Entering Duel Arena...</p>
      </div>
    );
  }

  const isChallenger = currentUserId === matchData.challengerId;
  const myUsername = isChallenger ? matchData.challengerUsername : matchData.challengeeUsername;
  const opponentUsername = isChallenger ? matchData.challengeeUsername : matchData.challengerUsername;
  
  const myScore = isChallenger ? matchData.challengerScore : matchData.challengeeScore;
  const opponentScore = isChallenger ? matchData.challengeeScore : matchData.challengerScore;

  const myFinishedStatus = isChallenger ? matchData.challengerFinished : matchData.challengeeFinished;
  const opponentFinishedStatus = isChallenger ? matchData.challengeeFinished : matchData.challengerFinished;

  const opponentMicActive = isChallenger ? matchData.mic2 : matchData.mic1;

  // Render winner state when both players finished
  const bothFinished = myFinishedStatus && opponentFinishedStatus;
  const isWinner = myScore > opponentScore;
  const isDraw = myScore === opponentScore;

  return (
    <div className="fixed inset-0 z-40 bg-zinc-950 flex flex-col overflow-hidden text-white font-sans">
      
      {/* 1. Header Board */}
      <div className="bg-zinc-900 border-b border-white/10 px-4 py-3.5 flex items-center justify-between shadow-md relative z-20">
        <div className="flex items-center gap-2">
          <div className="bg-red-500/20 text-red-400 p-2 rounded-xl border border-red-500/30">
            <Swords className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-black text-rose-400 tracking-wider uppercase">DUEL MATCH</h1>
            <p className="text-[10px] text-white/40 tracking-widest uppercase">ID: {matchId.replace('match_', '')}</p>
          </div>
        </div>

        {/* Live Head-to-Head Score comparison */}
        <div className="flex items-center gap-4 bg-black/40 px-5 py-1.5 rounded-full border border-white/5 font-extrabold text-sm shadow-inner">
          <div className="text-right">
            <span className="block text-[10px] text-white/30 uppercase font-bold">You</span>
            <span className="text-emerald-400 text-lg leading-none">{myScore}</span>
          </div>
          <div className="text-white/20 text-xs tracking-wider">VS</div>
          <div className="text-left">
            <span className="block text-[10px] text-white/30 uppercase font-bold">{opponentUsername}</span>
            <span className={cn("text-lg leading-none", opponentScore > myScore ? "text-rose-400 animate-pulse" : "text-white/60")}>
              {opponentScore}
            </span>
          </div>
        </div>

        <button 
          onClick={endMatchAndQuit}
          className="px-3.5 py-1.5 bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-white text-xs font-black uppercase tracking-wider rounded-lg transition-all"
        >
          Quit Duel
        </button>
      </div>

      {/* 2. Top Banner alert for Voice Activity Indicator / Toast messages */}
      <AnimatePresence>
        {activeToast && (
          <motion.div
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            className="absolute top-20 left-1/2 -translate-x-1/2 z-30 bg-indigo-600 px-6 py-2.5 rounded-full shadow-2xl flex items-center gap-3 border border-indigo-400/30 text-white fill-current"
          >
            <Smile className="w-4 h-4 text-indigo-300" />
            <span className="text-xs font-black">
              {activeToast.senderId === currentUserId ? 'You' : opponentUsername}:
            </span>
            <span className="text-xs font-bold text-indigo-100">{activeToast.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col md:flex-row p-4 gap-4 overflow-hidden relative">
        
        {/* LEFT SIDE: Your Playable Grid */}
        <div className="flex-1 flex flex-col items-center justify-center bg-zinc-900/40 rounded-2xl p-4 border border-white/5 shadow-xl relative">
          
          {/* My Label */}
          <div className="w-full max-w-sm flex items-center justify-between mb-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="font-bold uppercase tracking-wider">{myUsername} (You)</span>
            </div>
            {myFinishedStatus ? (
              <span className="px-2 py-0.5 bg-rose-500/20 text-rose-400 rounded text-[10px] font-bold uppercase tracking-wide flex items-center gap-1">
                <Skull className="w-3 h-3" /> Grid Blocked
              </span>
            ) : (
              <span className="text-white/40 font-semibold uppercase tracking-wider text-[10px] bg-white/5 px-2 py-0.5 rounded">Playing Live</span>
            )}
          </div>

          {/* Interactive grid container */}
          <div 
            ref={gridRef}
            className="relative bg-zinc-950 p-2.5 rounded-2xl grid grid-cols-8 gap-1 shadow-2xl border-2 border-zinc-800/80 aspect-square w-full max-w-sm"
          >
            {grid.map((row, rI) =>
              row.map((cell, cI) => {
                // Determine matches cell styling rules
                const isClearing = clearingRows.includes(rI) || clearingCols.includes(cI);
                const isGhost = hoverGridPos ? availableShapes[dragState?.index ?? -1]?.matrix[rI - hoverGridPos.gridY]?.[cI - hoverGridPos.gridX] === 1 : false;
                const ghostColor = hoverGridPos ? availableShapes[dragState?.index ?? -1]?.colorClass : null;

                return (
                  <div
                    key={`${rI}-${cI}`}
                    style={{ height: gridCellSize, width: gridCellSize }}
                    className={cn(
                      "rounded-[4px] transition-all duration-200 relative",
                      cell.isFilled && cell.colorClass ? cell.colorClass + ' block-cell' : 'bg-white/[0.02] border border-white/[0.01]',
                      isGhost && !cell.isFilled && `${ghostColor} opacity-40 animate-pulse block-cell`,
                      isClearing && 'scale-90 opacity-0 bg-white'
                    )}
                  />
                )
              })
            )}

            {/* Game over full block screen */}
            {isGameOverStatus && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center text-center p-4">
                <Skull className="w-12 h-12 text-rose-500 mb-3" />
                <h3 className="text-lg font-black text-white">GRID BLOCKED</h3>
                <p className="text-xs text-white/50 mt-1 max-w-[200px]">Waiting for friend to complete their moves...</p>
              </div>
            )}
          </div>

          {/* Bottom shapes deck */}
          <div className="w-full max-w-sm mt-4 grid grid-cols-3 gap-3">
            {availableShapes.map((shape, idx) => (
              <div
                key={idx}
                className="bg-zinc-950/80 rounded-xl p-2.5 border border-white/5 h-[80px] flex items-center justify-center relative touch-none cursor-grab active:cursor-grabbing"
                onPointerDown={(e) => handleDragStart(idx, e)}
                onPointerMove={handleDragMove}
                onPointerUp={(e) => handleDragEnd(idx, e)}
              >
                {shape ? (
                  <PreviewShape shape={shape} cellSize={15} />
                ) : (
                  <div className="w-1.5 h-1.5 bg-white/20 rounded-full" />
                )}
              </div>
            ))}
          </div>

        </div>

        {/* MIDDLE CONTROL BAR (Mic, Speakers, Chat triggers) */}
        <div className="md:w-[220px] bg-zinc-900/60 rounded-2xl p-4 border border-white/5 flex flex-col justify-between gap-4">
          
          {/* Avatar and Microphone volume activity display */}
          <div className="bg-black/30 rounded-xl p-3 flex flex-col items-center justify-center text-center relative overflow-hidden border border-white/5 shadow-inner">
            <div className="relative">
              {/* Voice activity circles glowing */}
              <AnimatePresence>
                {isMicOn && myVolume > 0.05 && (
                  <motion.span
                    initial={{ scale: 0.8, opacity: 0.6 }}
                    animate={{ scale: 1 + myVolume, opacity: 0 }}
                    transition={{ repeat: Infinity, duration: 1 }}
                    className="absolute inset-0 rounded-full bg-indigo-500 border border-indigo-400"
                  />
                )}
              </AnimatePresence>

              <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 border-2 border-indigo-400 flex items-center justify-center text-white text-xl font-bold relative z-10 shadow-lg select-none">
                {myUsername?.[0]?.toUpperCase()}
              </div>
            </div>

            <p className="text-xs font-black mt-2.5 tracking-wide">{myUsername}</p>
            <div className="flex items-center gap-1.5 mt-1 text-[10px] font-bold uppercase tracking-wider text-white/40">
              <Radio className={cn("w-3 h-3 text-indigo-400", isMicOn && myVolume > 0.05 && "animate-pulse")} />
              <span>{isMicOn ? "Mic Live" : "Mic Muted"}</span>
            </div>

            {/* Audio actions */}
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={() => { sound.playClick?.(); setIsMicOn(!isMicOn); }}
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                  isMicOn ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/20" : "bg-zinc-800 text-white/40 border border-white/5 hover:text-white"
                )}
                title="Toggle Mic"
              >
                {isMicOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              </button>
              <button
                onClick={() => { sound.playClick?.(); setIsSpeakerOn(!isSpeakerOn); }}
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                  isSpeakerOn ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20" : "bg-zinc-800 text-white/40 border border-white/5 hover:text-white"
                )}
                title="Mute Friend"
              >
                {isSpeakerOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="border-t border-b border-white/5 py-4 my-1 flex flex-col gap-2">
            <h4 className="text-[10px] font-black tracking-widest text-white/40 uppercase mb-1">Quick Messages</h4>
            {CHAT_TEMPLATES.map((tpl, i) => (
              <button
                key={i}
                onClick={() => sendTemplateMessage(tpl)}
                className="w-full text-left bg-white/5 hover:bg-white/10 active:scale-95 text-xs text-white/80 font-semibold px-3 py-2 rounded-xl border border-white/5 hover:border-indigo-500/50 transition-all truncate"
              >
                {tpl}
              </button>
            ))}
          </div>

          <div className="text-[9px] text-center text-white/30 font-medium">
            Mute/unmute microphone anytime to control conversation.
          </div>
        </div>

        {/* RIGHT SIDE: Opponent stats view (Live feed mockup) */}
        <div className="flex-1 max-w-sm flex flex-col items-center justify-center bg-zinc-900/30 rounded-2xl p-4 border border-zinc-800">
          
          {/* Opponent Identity Header */}
          <div className="w-full max-w-xs flex items-center justify-between mb-3 text-xs">
            <div className="flex items-center gap-2">
              <span className={cn("inline-block w-2.5 h-2.5 rounded-full bg-rose-500 mr-0.5", opponentMicActive && "animate-pulse")} />
              <span className="font-bold uppercase tracking-wider">{opponentUsername} (Friend)</span>
            </div>
            {opponentMicActive ? (
              <span className="text-indigo-400 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                <Mic className="w-3 h-3" /> Voice active
              </span>
            ) : null}
          </div>

          {/* Opponent score layout / Gameboard Mock */}
          <div className="w-full max-w-xs bg-zinc-950 p-5 rounded-2xl border border-white/5 flex flex-col items-center justify-center text-center aspect-square shadow-inner relative justify-between py-8">
            <div className="w-full flex justify-between">
              <Flame className="w-6 h-6 text-orange-500" />
              <Swords className="w-6 h-6 text-zinc-600" />
            </div>

            <div className="my-3">
              <span className="block text-[11px] text-white/30 uppercase font-black tracking-widest">LIVE SCORE</span>
              <span className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-pink-400 to-rose-400 leading-none block mt-1 tracking-tighter">
                {opponentScore}
              </span>
            </div>

            <div className="w-full">
              {opponentFinishedStatus ? (
                <div className="flex flex-col items-center gap-1.5 bg-rose-500/15 border border-rose-500/30 py-3 rounded-xl">
                  <Skull className="w-5 h-5 text-rose-400 animate-bounce" />
                  <span className="text-rose-400 text-xs font-black uppercase tracking-wider">LOCKED OUT</span>
                  <span className="text-[10px] text-white/40 font-bold">Game Over! Score settled at {opponentScore}</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 bg-emerald-500/10 border border-emerald-500/20 py-2.5 rounded-xl">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                  <span className="text-emerald-400 text-xs font-black uppercase tracking-wider">STILL PLAYING...</span>
                </div>
              )}
            </div>

          </div>

          {/* Static advice / Status tracker */}
          <div className="w-full max-w-xs bg-black/20 text-[10px] font-bold uppercase tracking-wide px-3 py-2.5 rounded-xl border border-white/5 mt-4 text-center">
            {myScore > opponentScore ? (
              <span className="text-emerald-400">🔥 You are in the lead!</span>
            ) : myScore < opponentScore ? (
              <span className="text-rose-400">⚠️ Opponent is currently leading!</span>
            ) : (
              <span className="text-white/40">⚖️ Score is completely tied!</span>
            )}
          </div>

        </div>

      </div>

      {/* 3. Global Fullscreen winner overlay when match settles */}
      <AnimatePresence>
        {bothFinished && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
          >
            <motion.div
              initial={{ scale: 0.9, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-zinc-900 border-2 border-indigo-500/40 p-8 rounded-3xl max-w-md w-full shadow-2xl relative"
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg border-2 border-indigo-400 text-white">
                <Trophy className="w-8 h-8 fill-current" />
              </div>

              <h2 className="text-2xl font-black uppercase tracking-wider mt-6">
                {isDraw ? "IT'S A DRAW!" : isWinner ? "VICTORY!" : "DEFEAT!"}
              </h2>
              <p className="text-sm text-white/50 mt-2">
                {isDraw ? "Unbelievable! You matched each other score for score." : isWinner ? "Superb work! You blasted your friend out of the grid!" : "Better luck next time. Your opponent swept this duel!"}
              </p>

              <div className="grid grid-cols-2 gap-4 bg-zinc-950/80 p-5 rounded-2xl border border-white/5 my-6">
                <div className="border-r border-white/5">
                  <span className="block text-[10px] text-white/40 uppercase font-bold tracking-widest">My Score</span>
                  <span className="text-2xl font-black text-emerald-400 block mt-1">{myScore}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-white/40 uppercase font-bold tracking-widest">Friend Score</span>
                  <span className="text-2xl font-black text-rose-400 block mt-1">{opponentScore}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={async () => {
                    sound.playClick?.();
                    try {
                      await deleteDoc(doc(db, 'matches', matchId));
                    } catch (e) {}
                    onGoHome();
                  }}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition-colors uppercase tracking-wider text-xs"
                >
                  Return to Menu
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
