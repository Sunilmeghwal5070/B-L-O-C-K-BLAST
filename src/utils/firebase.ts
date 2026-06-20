import { initializeApp } from "firebase/app";
import { getFirestore, disableNetwork, enableNetwork } from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged, User } from "firebase/auth";

const firebaseConfig = {
  projectId: "decisive-grail-mjkjx",
  appId: "1:51353023047:web:2e032373312850696d3762",
  apiKey: "AIzaSyDtysbNf5OEeqq9VHLyB8PVvZxm2-GQP9E",
  authDomain: "decisive-grail-mjkjx.firebaseapp.com",
  storageBucket: "decisive-grail-mjkjx.firebasestorage.app",
  messagingSenderId: "51353023047",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, "ai-studio-58b11b8a-086e-40dc-a0ea-b6479777254c");
export const auth = getAuth(app);

export let currentUser: User | null = null;
export const initAuth = (): Promise<User | null> => {
    return new Promise((resolve) => {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                currentUser = user;
                resolve(user);
            } else {
                try {
                    const cred = await signInAnonymously(auth);
                    currentUser = cred.user;
                    resolve(cred.user);
                } catch(error: any) {
                    // Ignore expected error when anonymous auth is disabled
                    if (error?.code !== 'auth/admin-restricted-operation') {
                        console.warn("Auth warning", error);
                    }
                    resolve(null);
                }
            }
        });
    });
};
