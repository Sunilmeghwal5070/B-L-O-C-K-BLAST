import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, X, Search, UserPlus, Check, UserMinus, Clock, UserCheck, Play, Wifi, WifiOff } from 'lucide-react';
import { sound } from '../utils/soundEngine';
import { cn } from '../utils/cn';
import { safeStorage } from '../utils/safeStorage';
import { db, auth } from '../utils/firebase';
import { collection, query, where, getDocs, setDoc, doc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

type Props = {
  onClose: () => void;
};

type Tab = 'friends' | 'requests' | 'add';

type FriendUser = {
  id: string;
  username: string;
};

type Friendship = {
  id: string;
  users: string[];
  senderId: string;
  receiverId: string;
  senderUsername: string;
  receiverUsername: string;
  status: 'pending' | 'accepted';
};

export function FriendsModal({ onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FriendUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [userPresenceMap, setUserPresenceMap] = useState<Record<string, { isOnline: boolean, lastActive?: string }>>({});

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsub = onSnapshot(q, (snapshot) => {
      const pMap: Record<string, { isOnline: boolean, lastActive?: string }> = {};
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        let isOnline = !!data.isOnline;
        if (data.lastActive) {
          const diffMs = Date.now() - new Date(data.lastActive).getTime();
          if (diffMs > 30000) { // stale active timestamp > 30 seconds means offline
            isOnline = false;
          }
        }
        pMap[docSnap.id] = {
          isOnline,
          lastActive: data.lastActive
        };
      });
      setUserPresenceMap(pMap);
    }, (error) => {
      console.warn("Presence sync error ignored:", error);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged(user => {
      setCurrentUserId(user ? user.uid : null);
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!currentUserId) return;

    const q = query(
      collection(db, 'friendships'),
      where('users', 'array-contains', currentUserId)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const data: Friendship[] = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() } as Friendship);
      });
      setFriendships(data);
    }, (error) => {
      console.warn("Friends sync error ignored:", error);
    });

    return () => unsub();
  }, [currentUserId]);

  const handleSearch = async (queryToSearch: string = searchQuery) => {
    let term = queryToSearch.trim();
    if (!term || !currentUserId) {
        setSearchResults([]);
        return;
    }
    setIsSearching(true);
    
    // Ensure the search term starts with '@' since all usernames are stored with it
    if (!term.startsWith('@')) {
      term = '@' + term;
    }
    
    const normalizedSearch = term.toLowerCase();
    
    try {
      let q = query(
        collection(db, 'users'),
        where('username_lower', '>=', normalizedSearch),
        where('username_lower', '<=', normalizedSearch + '\uf8ff')
      );
      let snapshot = await getDocs(q);
      
      // Fallback to case-sensitive exact match if prefix lower search yields nothing (for legacy users)
      if (snapshot.empty && term.length > 2) {
         q = query(
           collection(db, 'users'),
           where('username', '==', term)
         );
         snapshot = await getDocs(q);
      }

      const results: FriendUser[] = [];
      snapshot.forEach(doc => {
        if (doc.id !== currentUserId) {
          results.push({ id: doc.id, username: doc.data().username });
        }
      });
      setSearchResults(results);
    } catch (e) {
      console.warn("Search error:", e);
    }
    setIsSearching(false);
  };

  useEffect(() => {
     if (activeTab === 'add') {
         const timeoutId = setTimeout(() => {
             handleSearch(searchQuery);
         }, 300);
         return () => clearTimeout(timeoutId);
     }
  }, [searchQuery, activeTab, currentUserId]);

  const sendRequest = async (targetUser: FriendUser) => {
    if (!currentUserId) return;
    sound.playClick?.();
    const myUsername = safeStorage.getItem('block_blast_username') || 'Unknown';
    const friendshipId = [currentUserId, targetUser.id].sort().join('_');
    
    try {
      await setDoc(doc(db, 'friendships', friendshipId), {
        users: [currentUserId, targetUser.id],
        senderId: currentUserId,
        receiverId: targetUser.id,
        senderUsername: myUsername,
        receiverUsername: targetUser.username,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      console.warn("Send request error:", e);
    }
  };

  const acceptRequest = async (f: Friendship) => {
    if (!currentUserId) return;
    sound.playClick?.();
    try {
      await updateDoc(doc(db, 'friendships', f.id), {
        status: 'accepted',
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      console.warn("Accept request error:", e);
    }
  };

  const removeOrDecline = async (f: Friendship) => {
    if (!currentUserId) return;
    sound.playClick?.();
    try {
      await deleteDoc(doc(db, 'friendships', f.id));
    } catch (e) {
      console.warn("Remove request error:", e);
    }
  };

  const startMatchChallenge = async (friendId: string, friendUsername: string) => {
    if (!currentUserId) return;
    sound.playClick?.();
    const myUsername = safeStorage.getItem('block_blast_username') || 'Unknown';
    // Generate match document
    const matchId = `match_${[currentUserId, friendId].sort().join('_')}`;
    try {
      await setDoc(doc(db, 'matches', matchId), {
        users: [currentUserId, friendId],
        challengerId: currentUserId,
        challengeeId: friendId,
        challengerUsername: myUsername,
        challengeeUsername: friendUsername,
        status: 'pending',
        challengerScore: 0,
        challengeeScore: 0,
        challengerFinished: false,
        challengeeFinished: false,
        mic1: true,
        mic2: true,
        sound1: true,
        sound2: true,
        chatText: 'Match challenge initiated! Get ready!',
        chatSenderId: currentUserId,
        chatTime: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, { merge: true });
      alert(`Game challenge sent to ${friendUsername}! Please wait for them to accept.`);
    } catch (e) {
      console.warn("Challenge match error:", e);
    }
  };

  const friends = friendships.filter(f => f.status === 'accepted');
  const incomingRequests = friendships.filter(f => f.status === 'pending' && f.receiverId === currentUserId);
  const outgoingRequests = friendships.filter(f => f.status === 'pending' && f.senderId === currentUserId);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="relative w-full max-w-md bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-zinc-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Users className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-white">Friends</h2>
          </div>
          <button 
            onClick={() => { sound.playClick?.(); onClose(); }}
            className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center text-white/50 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex p-2 bg-zinc-800/30 border-b border-white/5 gap-2 overflow-x-auto no-scrollbar">
          {(['friends', 'requests', 'add'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => { sound.playClick?.(); setActiveTab(t); }}
              className={cn(
                "flex-1 px-4 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider transition-all whitespace-nowrap",
                activeTab === t ? "bg-indigo-500 text-white shadow-lg" : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white"
              )}
            >
              {t === 'friends' && 'My Friends'}
              {t === 'requests' && (
                <span className="flex items-center justify-center gap-2">
                  Requests 
                  {incomingRequests.length > 0 && (
                    <span className="bg-rose-500 text-white text-xs px-1.5 py-0.5 rounded-full">{incomingRequests.length}</span>
                  )}
                </span>
              )}
              {t === 'add' && 'Search'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-[300px]">
          {activeTab === 'friends' && (
            <AnimatePresence mode="popLayout">
              {friends.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="w-16 h-16 text-white/10 mb-4" />
                  <p className="text-white/40 font-medium">No friends yet.</p>
                  <button onClick={() => setActiveTab('add')} className="mt-4 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm transition-colors">
                    Find Friends
                  </button>
                </motion.div>
              ) : (
                friends.map(f => {
                  const friendUsername = f.senderId === currentUserId ? f.receiverUsername : f.senderUsername;
                  const friendId = f.senderId === currentUserId ? f.receiverId : f.senderId;
                  const isOnline = !!userPresenceMap[friendId]?.isOnline;
                  return (
                    <motion.div
                      key={f.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg relative">
                          {friendUsername?.[0]?.toUpperCase()}
                          <span className={cn("absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-zinc-900", isOnline ? "bg-emerald-500" : "bg-zinc-500")} />
                        </div>
                        <div>
                          <p className="text-white font-bold">{friendUsername}</p>
                          <p className={cn("text-xs font-semibold mt-0.5", isOnline ? "text-emerald-400" : "text-zinc-500")}>
                            {isOnline ? "Online" : "Offline"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => startMatchChallenge(friendId, friendUsername || 'Friend')}
                          className="px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs uppercase tracking-wide rounded-lg flex items-center gap-1 shadow-md active:scale-95 transition-all"
                        >
                          <Play className="w-3 h-3 fill-white text-emerald-100" /> Play
                        </button>
                        <button 
                          onClick={() => removeOrDecline(f)} 
                          title="Remove Friend"
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  )
                })
              )}
            </AnimatePresence>
          )}

          {activeTab === 'requests' && (
            <AnimatePresence mode="popLayout">
              {incomingRequests.length === 0 && outgoingRequests.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-12 text-center">
                  <Clock className="w-16 h-16 text-white/10 mb-4" />
                  <p className="text-white/40 font-medium">No pending requests.</p>
                </motion.div>
              ) : (
                <>
                  {incomingRequests.map(f => (
                    <motion.div
                      key={f.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-400 font-bold text-lg">
                          {f.senderUsername?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-white font-bold">{f.senderUsername}</p>
                          <p className="text-rose-400 text-xs font-medium">Incoming Request</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => removeOrDecline(f)} className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/5 text-white/60 hover:bg-red-500/20 hover:text-red-400 transition-colors">
                          <X className="w-5 h-5" />
                        </button>
                        <button onClick={() => acceptRequest(f)} className="w-10 h-10 flex items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-colors">
                          <Check className="w-5 h-5" />
                        </button>
                      </div>
                    </motion.div>
                  ))}

                  {outgoingRequests.length > 0 && <div className="text-white/30 text-xs font-bold uppercase tracking-wider mt-4 mb-2">Sent Requests</div>}

                  {outgoingRequests.map(f => (
                    <motion.div
                      key={f.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 opacity-70"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-lg">
                          {f.receiverUsername?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-white font-bold">{f.receiverUsername}</p>
                          <p className="text-indigo-400 text-xs font-medium">Pending Response</p>
                        </div>
                      </div>
                      <button onClick={() => removeOrDecline(f)} className="text-xs text-white/40 hover:text-red-400 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors">
                        Cancel
                      </button>
                    </motion.div>
                  ))}
                </>
              )}
            </AnimatePresence>
          )}

          {activeTab === 'add' && (
            <div className="flex flex-col gap-4">
              <form onSubmit={e => { e.preventDefault(); handleSearch(); }} className="relative flex items-center">
                <Search className="absolute left-4 w-5 h-5 text-white/40" />
                <input
                  type="text"
                  placeholder="Enter username..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-24 text-white font-medium focus:outline-none focus:border-indigo-500 focus:bg-white/10 transition-colors"
                />
                <button
                  type="submit"
                  disabled={isSearching || !searchQuery.trim()}
                  className="absolute right-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:bg-indigo-500 text-white font-bold text-sm rounded-lg transition-colors"
                >
                  {isSearching ? '...' : 'Search'}
                </button>
              </form>

              <div className="space-y-2 mt-2">
                {searchResults.length === 0 && searchQuery && !isSearching && (
                  <p className="text-center text-white/40 py-8">No users found.</p>
                )}
                {searchResults.map(user => {
                  const existingFriendship = friendships.find(f => f.users.includes(user.id));
                  let actionBtn = (
                    <button onClick={() => sendRequest(user)} className="px-3 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
                      <UserPlus className="w-4 h-4" /> Add
                    </button>
                  );

                  if (existingFriendship) {
                    if (existingFriendship.status === 'accepted') {
                      actionBtn = <div className="px-3 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-bold flex items-center gap-2 border border-emerald-500/20"><UserCheck className="w-4 h-4"/> Friend</div>;
                    } else if (existingFriendship.senderId === currentUserId) {
                      actionBtn = <div className="px-3 py-2 bg-white/5 text-white/50 rounded-lg text-sm font-bold">Requested</div>;
                    } else {
                      actionBtn = <button onClick={() => acceptRequest(existingFriendship)} className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-bold transition-colors">Accept</button>;
                    }
                  }

                  return (
                    <motion.div
                      key={user.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-lg">
                          {user.username[0].toUpperCase()}
                        </div>
                        <p className="text-white font-bold">{user.username}</p>
                      </div>
                      {actionBtn}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
